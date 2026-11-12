"use server";

import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import type { Dano, DatosSiniestro } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { buscarVehiculo, normalizarMatricula } from "@/lib/data";
import { guardarFotos } from "@/lib/fotos";
import { siguienteNumeroOT } from "@/lib/numeracion";
import { tallerPorId } from "@/lib/taller";
import { fotosComoDataUrl, guardarDocumento, prepararEvidencia, tallerParaPdf, validarFirma } from "@/lib/pdf/generar";
import { ResguardoPdf } from "@/lib/pdf/plantillas";

export async function buscarPorMatricula(matricula: string) {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const r = await buscarVehiculo(s.tid, matricula);
  if (!r) return null;
  // ¿Ya está en el taller?
  const abierta = await db.query.ordenesTrabajo.findFirst({
    where: and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.vehiculoId, r.vehiculo.id), isNull(t.ordenesTrabajo.cerradaEn)),
  });
  return { vehiculo: r.vehiculo, cliente: r.cliente, otAbierta: abierta ? { id: abierta.id, numero: abierta.numero } : null };
}

const opcional = z.string().trim().optional().transform((v) => (v ? v : null));
const entero = z.coerce.number().int().nonnegative().optional().nullable();

const Esquema = z.object({
  citaId: opcional,
  vehiculoId: opcional,
  clienteId: opcional,
  matricula: z.string().trim().min(4, "Matrícula obligatoria"),
  marca: opcional,
  modelo: opcional,
  bastidor: opcional,
  color: opcional,
  clienteNombre: z.string().trim().min(2, "Nombre del cliente obligatorio"),
  clienteNif: opcional,
  clienteTelefono: opcional,
  clienteEmail: z.string().trim().email("Email no válido").optional().or(z.literal("")).transform((v) => v || null),
  aceptaLlamada: z.coerce.boolean().optional(),
  aceptaWhatsapp: z.coerce.boolean().optional(),
  aceptaEmail: z.coerce.boolean().optional(),
  tipoOrdenId: z.string().uuid("Elige el tipo de orden"),
  trabajo: opcional,
  fechaEntrada: z.coerce.date().optional(),
  fechaPrevista: opcional,
  renunciaPresupuesto: z.coerce.boolean().optional(),
  km: entero,
  combustible: z.coerce.number().int().min(0).max(8),
  testigos: z.array(z.string()).default([]),
  objetos: z.array(z.string()).default([]),
  danos: z.array(z.object({ x: z.number(), y: z.number(), tipo: z.string(), nota: z.string().optional(), vista: z.enum(["superior", "izquierdo", "derecho", "frontal", "trasera"]).optional() })).default([]),
  observaciones: opcional,
  siniestro: z
    .object({
      companiaId: opcional,
      numeroSiniestro: opcional,
      numeroPoliza: opcional,
      perito: opcional,
      franquicia: z.coerce.number().nonnegative().optional().nullable(),
      cubreSustitucion: z.coerce.boolean().optional(),
    })
    .optional()
    .nullable(),
  firmante: z.string().trim().min(2, "Nombre de quien firma obligatorio"),
});

export async function crearRecepcion(fd: FormData): Promise<{ error?: string }> {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const firma = validarFirma(fd.get("firma"));
  if (!firma) return { error: "Falta la firma del cliente" };

  let datos: z.infer<typeof Esquema>;
  try {
    datos = Esquema.parse(JSON.parse(String(fd.get("datos"))));
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Datos no válidos";
    return { error: msg };
  }

  const taller = await tallerPorId(s.tid);
  const tipo = await db.query.tiposOrden.findFirst({ where: and(eq(t.tiposOrden.tallerId, s.tid), eq(t.tiposOrden.id, datos.tipoOrdenId)) });
  if (!tipo) return { error: "Tipo de orden no válido" };
  const [estadoInicial] = await db
    .select()
    .from(t.estadosFlujo)
    .where(and(eq(t.estadosFlujo.tallerId, s.tid), eq(t.estadosFlujo.tipoOrdenId, tipo.id)))
    .orderBy(asc(t.estadosFlujo.orden))
    .limit(1);

  let siniestro: DatosSiniestro | null = null;
  if (tipo.requiereSiniestro && datos.siniestro) {
    const comp = datos.siniestro.companiaId
      ? await db.query.clientes.findFirst({ where: and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, datos.siniestro.companiaId)) })
      : null;
    siniestro = {
      companiaId: comp?.id,
      companiaNombre: comp?.nombre,
      numeroSiniestro: datos.siniestro.numeroSiniestro ?? undefined,
      numeroPoliza: datos.siniestro.numeroPoliza ?? undefined,
      perito: datos.siniestro.perito ?? undefined,
      franquicia: datos.siniestro.franquicia ?? undefined,
      cubreSustitucion: !!datos.siniestro.cubreSustitucion,
    };
  }

  // Fecha de recepción: la indicada (p. ej. coche dejado fuera de horario), nunca futura
  const ahora = new Date();
  const fechaEntrada = datos.fechaEntrada && !isNaN(datos.fechaEntrada.getTime()) && datos.fechaEntrada <= ahora ? datos.fechaEntrada : ahora;
  const trabajo = datos.trabajo ?? tipo.nombre;

  const matricula = normalizarMatricula(datos.matricula);
  // Doble envío (doble toque, reintento tras un corte): si esta misma persona acaba de abrir una orden
  // para esta matrícula, se lleva a ella en vez de crear otra.
  const reciente = await db
    .select({ id: t.ordenesTrabajo.id })
    .from(t.ordenesTrabajo)
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .where(
      and(
        eq(t.ordenesTrabajo.tallerId, s.tid),
        eq(t.vehiculos.matricula, matricula),
        eq(t.ordenesTrabajo.asesorId, s.uid),
        isNull(t.ordenesTrabajo.cerradaEn),
        gt(t.ordenesTrabajo.creadaEn, new Date(Date.now() - 2 * 60_000)),
      ),
    )
    .limit(1);
  if (reciente.length) redirect(`/ot/${reciente[0].id}?nueva=1`);

  const ev = await prepararEvidencia(s, datos.firmante);

  const otId = await db.transaction(async (tx) => {
    // Cliente: existente (se actualizan contacto/consentimientos) o nuevo
    let clienteId = datos.clienteId;
    const datosCliente = {
      nombre: datos.clienteNombre,
      nif: datos.clienteNif,
      telefono: datos.clienteTelefono,
      email: datos.clienteEmail,
      aceptaLlamada: !!datos.aceptaLlamada,
      aceptaWhatsapp: !!datos.aceptaWhatsapp,
      aceptaEmail: !!datos.aceptaEmail,
    };
    if (clienteId) {
      const ok = await tx.update(t.clientes).set(datosCliente).where(and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, clienteId))).returning({ id: t.clientes.id });
      if (!ok.length) throw new Error("Cliente no válido");
    } else {
      [{ id: clienteId }] = await tx.insert(t.clientes).values({ tallerId: s.tid, ...datosCliente }).returning({ id: t.clientes.id });
    }

    // Vehículo
    let vehiculoId = datos.vehiculoId;
    const datosVeh = { clienteId, matricula, marca: datos.marca, modelo: datos.modelo, bastidor: datos.bastidor, color: datos.color, kmUltimo: datos.km ?? null };
    if (vehiculoId) {
      const ok = await tx.update(t.vehiculos).set(datosVeh).where(and(eq(t.vehiculos.tallerId, s.tid), eq(t.vehiculos.id, vehiculoId))).returning({ id: t.vehiculos.id });
      if (!ok.length) throw new Error("Vehículo no válido");
    } else {
      [{ id: vehiculoId }] = await tx
        .insert(t.vehiculos)
        .values({ tallerId: s.tid, ...datosVeh })
        .onConflictDoUpdate({ target: [t.vehiculos.tallerId, t.vehiculos.matricula], set: datosVeh })
        .returning({ id: t.vehiculos.id });
    }

    const numero = await siguienteNumeroOT(tx, s.tid);
    const [ot] = await tx
      .insert(t.ordenesTrabajo)
      .values({
        tallerId: s.tid,
        numero,
        tipoOrdenId: tipo.id,
        estadoId: estadoInicial.id,
        clienteId: clienteId!,
        vehiculoId: vehiculoId!,
        asesorId: s.uid,
        fechaEntrada,
        fechaPrevista: datos.fechaPrevista,
        trabajoSolicitado: trabajo,
        datosSiniestro: siniestro,
      })
      .returning();
    await tx.insert(t.historialEstados).values({ tallerId: s.tid, otId: ot.id, estadoId: estadoInicial.id, usuarioId: s.uid, comentario: "Recepción firmada" });

    const [rec] = await tx
      .insert(t.recepciones)
      .values({
        tallerId: s.tid,
        otId: ot.id,
        km: datos.km ?? null,
        combustible: datos.combustible,
        testigos: datos.testigos,
        objetos: datos.objetos,
        danos: datos.danos as Dano[],
        observaciones: datos.observaciones,
      })
      .returning();

    if (datos.citaId) await tx.update(t.citas).set({ otId: ot.id, clienteId, vehiculoId }).where(and(eq(t.citas.tallerId, s.tid), eq(t.citas.id, datos.citaId)));
    return { ot, rec, numero, clienteId: clienteId!, vehiculoId: vehiculoId! };
  });

  // Fotos (fuera de la transacción: escriben en disco)
  await guardarFotos(s, fd.getAll("fotos"), { otId: otId.ot.id, entidad: "recepcion", entidadId: otId.rec.id });
  const fotos = await db.select().from(t.archivos).where(and(eq(t.archivos.tallerId, s.tid), eq(t.archivos.entidadId, otId.rec.id)));

  // PDF firmado del resguardo
  await db.transaction(async (tx) => {
    const doc = await guardarDocumento(
      tx,
      s,
      ev,
      "resguardo",
      otId.ot.id,
      ResguardoPdf({
        taller: tallerParaPdf(taller),
        evidencia: ev,
        numeroOT: otId.numero,
        tipoOrden: tipo.nombre,
        cliente: { nombre: datos.clienteNombre, nif: datos.clienteNif, telefono: datos.clienteTelefono, email: datos.clienteEmail },
        vehiculo: { matricula, marca: datos.marca, modelo: datos.modelo, bastidor: datos.bastidor, color: datos.color },
        km: datos.km ?? null,
        combustible: datos.combustible,
        testigos: datos.testigos,
        objetos: datos.objetos,
        danos: datos.danos as Dano[],
        observaciones: datos.observaciones,
        trabajoSolicitado: trabajo,
        fechaEntrada,
        fechaPrevista: datos.fechaPrevista,
        renunciaPresupuesto: !!datos.renunciaPresupuesto,
        siniestro,
        fotos: await fotosComoDataUrl(fotos),
        textoLegal: taller.config.textoResguardo ?? "",
        firmaPng: firma,
      }),
    );
    await tx.update(t.recepciones).set({ documentoId: doc.id }).where(eq(t.recepciones.id, otId.rec.id));
  });

  await auditar(s, "crear_recepcion", "ot", otId.ot.id, { numero: otId.numero, matricula });
  revalidatePath("/", "layout");
  redirect(`/ot/${otId.ot.id}?nueva=1`);
}
