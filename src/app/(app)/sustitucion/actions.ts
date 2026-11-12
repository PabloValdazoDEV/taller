"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import type { Dano } from "@/db/schema";
import { tiene } from "@/lib/puestos";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { tallerPorId } from "@/lib/taller";
import { aniosDesde, fmtFecha } from "@/lib/formato";
import { DanosZ, danosNuevos, marcarOrigen } from "@/lib/danos";
import { guardarDocumento, prepararEvidencia, tallerParaPdf, validarFirma } from "@/lib/pdf/generar";
import { PrestamoPdf } from "@/lib/pdf/plantillas";

const PAGADOR: Record<string, string> = { aseguradora: "Aseguradora (póliza)", cortesia: "Cortesía del taller", cliente: "Cliente" };

const SalidaZ = z.object({
  otId: z.string().uuid(),
  cocheId: z.string().uuid("Elige un coche"),
  conductorNombre: z.string().trim().min(2, "Nombre del conductor obligatorio"),
  conductorDni: z.string().trim().min(5, "DNI/NIE obligatorio"),
  conductorNacimiento: z.string().date("Fecha de nacimiento obligatoria"),
  carnetFecha: z.string().date("Fecha del carnet obligatoria"),
  pagador: z.enum(["aseguradora", "cortesia", "cliente"]),
  kmSalida: z.coerce.number().int().nonnegative(),
  combSalida: z.coerce.number().int().min(0).max(8),
  danos: DanosZ,
  forzar: z.boolean().default(false),
});

export async function crearPrestamo(fd: FormData): Promise<{ error?: string }> {
  const s = await requireSesion("recepcion");
  const firma = validarFirma(fd.get("firma"));
  if (!firma) return { error: "Falta la firma del conductor" };
  const parsed = SalidaZ.safeParse(JSON.parse(String(fd.get("datos"))));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const taller = await tallerPorId(s.tid);
  const edadMin = taller.config.prestamoEdadMinima ?? 25;
  const aniosCarnet = taller.config.prestamoAniosCarnet ?? 2;
  const cumple = aniosDesde(d.conductorNacimiento) >= edadMin && aniosDesde(d.carnetFecha) >= aniosCarnet;
  if (!cumple && !d.forzar) return { error: `El conductor no cumple las condiciones (≥ ${edadMin} años y carnet ≥ ${aniosCarnet} años)` };
  if (!cumple && !tiene(s.puestos, "forzarPrestamo")) return { error: "Solo administración o jefe de taller pueden autorizar un préstamo fuera de condiciones" };

  const [ot, coche] = await Promise.all([
    db.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.id, d.otId)) }),
    db.query.cochesSustitucion.findFirst({ where: and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, d.cocheId)) }),
  ]);
  if (!ot || ot.cerradaEn) return { error: "Orden no válida" };
  if (!coche || coche.estado !== "disponible") return { error: "El coche no está disponible" };

  const ev = await prepararEvidencia(s, d.conductorNombre);
  const prestamoId = await db.transaction(async (tx) => {
    // Bloqueo optimista: solo se presta si sigue disponible
    const ok = await tx
      .update(t.cochesSustitucion)
      .set({ estado: "prestado", danos: d.danos as Dano[] })
      .where(and(eq(t.cochesSustitucion.id, coche.id), eq(t.cochesSustitucion.estado, "disponible")))
      .returning({ id: t.cochesSustitucion.id });
    if (!ok.length) throw new Error("El coche acaba de ser prestado");

    const doc = await guardarDocumento(
      tx, s, ev, "prestamo_salida", ot.id,
      PrestamoPdf({
        taller: await tallerParaPdf(taller),
        evidencia: ev,
        modo: "salida",
        coche,
        conductor: { nombre: d.conductorNombre, dni: d.conductorDni, nacimiento: d.conductorNacimiento, carnet: d.carnetFecha },
        pagador: PAGADOR[d.pagador],
        numeroOT: ot.numero,
        kmSalida: d.kmSalida,
        combSalida: d.combSalida,
        danosSalida: d.danos as Dano[],
        condicionesForzadas: !cumple,
        textoLegal: taller.config.textoPrestamo ?? "",
        firmaPng: firma,
      }),
    );
    const [p] = await tx
      .insert(t.prestamos)
      .values({
        tallerId: s.tid,
        cocheId: coche.id,
        otId: ot.id,
        conductorNombre: d.conductorNombre,
        conductorDni: d.conductorDni.toUpperCase(),
        conductorNacimiento: d.conductorNacimiento,
        carnetFecha: d.carnetFecha,
        condicionesForzadas: !cumple,
        pagador: d.pagador,
        kmSalida: d.kmSalida,
        combSalida: d.combSalida,
        danosSalida: d.danos as Dano[],
        docSalidaId: doc.id,
      })
      .returning();
    return p.id;
  });

  await auditar(s, "prestar_coche", "prestamo", prestamoId, { coche: coche.matricula, forzado: !cumple });
  revalidatePath("/", "layout");
  redirect(`/ot/${ot.id}`);
}

const DevolZ = z.object({
  prestamoId: z.string().uuid(),
  kmLlegada: z.coerce.number().int().nonnegative(),
  combLlegada: z.coerce.number().int().min(0).max(8),
  danos: DanosZ,
  observaciones: z.string().trim().optional(),
  firmante: z.string().trim().min(2, "Nombre de quien devuelve obligatorio"),
});

export async function devolverPrestamo(fd: FormData): Promise<{ error?: string }> {
  const s = await requireSesion("recepcion");
  const firma = validarFirma(fd.get("firma"));
  if (!firma) return { error: "Falta la firma" };
  const parsed = DevolZ.safeParse(JSON.parse(String(fd.get("datos"))));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const p = await db.query.prestamos.findFirst({ where: and(eq(t.prestamos.tallerId, s.tid), eq(t.prestamos.id, d.prestamoId), isNull(t.prestamos.devueltoEn)) });
  if (!p) return { error: "Préstamo no encontrado o ya devuelto" };
  if (d.kmLlegada < p.kmSalida) return { error: `Los km de llegada no pueden ser menores que los de salida (${p.kmSalida})` };
  const coche = (await db.query.cochesSustitucion.findFirst({ where: eq(t.cochesSustitucion.id, p.cocheId) }))!;
  const ot = p.otId ? await db.query.ordenesTrabajo.findFirst({ where: eq(t.ordenesTrabajo.id, p.otId) }) : null;
  const taller = await tallerPorId(s.tid);
  const ev = await prepararEvidencia(s, d.firmante);
  // Los daños nuevos quedan anotados con quién lo llevaba y cuándo, y pasan a la ficha del coche
  const danosLlegada = marcarOrigen(p.danosSalida, d.danos as Dano[], `Nuevo en devolución · ${p.conductorNombre} · ${fmtFecha(new Date())}${ot ? ` · OT ${ot.numero}` : ""}`);
  const nuevos = danosNuevos(p.danosSalida, d.danos as Dano[]).length;

  await db.transaction(async (tx) => {
    const doc = await guardarDocumento(
      tx, s, ev, "prestamo_devolucion", p.otId,
      PrestamoPdf({
        taller: await tallerParaPdf(taller),
        evidencia: ev,
        modo: "devolucion",
        coche,
        conductor: { nombre: p.conductorNombre, dni: p.conductorDni, nacimiento: p.conductorNacimiento, carnet: p.carnetFecha },
        pagador: PAGADOR[p.pagador],
        numeroOT: ot?.numero ?? null,
        kmSalida: p.kmSalida,
        combSalida: p.combSalida,
        danosSalida: p.danosSalida,
        kmLlegada: d.kmLlegada,
        combLlegada: d.combLlegada,
        danosLlegada,
        observaciones: d.observaciones,
        condicionesForzadas: p.condicionesForzadas,
        textoLegal: taller.config.textoPrestamo ?? "",
        firmaPng: firma,
      }),
    );
    await tx
      .update(t.prestamos)
      .set({ kmLlegada: d.kmLlegada, combLlegada: d.combLlegada, danosLlegada, observacionesLlegada: d.observaciones || null, docLlegadaId: doc.id, devueltoEn: new Date() })
      .where(eq(t.prestamos.id, p.id));
    await tx.update(t.cochesSustitucion).set({ estado: "disponible", km: d.kmLlegada, combustible: d.combLlegada, danos: danosLlegada }).where(eq(t.cochesSustitucion.id, coche.id));
  });

  await auditar(s, "devolver_coche", "prestamo", p.id, { km: d.kmLlegada - p.kmSalida, nuevosDanos: nuevos });
  revalidatePath("/", "layout");
  redirect(p.otId ? `/ot/${p.otId}` : "/sustitucion");
}
