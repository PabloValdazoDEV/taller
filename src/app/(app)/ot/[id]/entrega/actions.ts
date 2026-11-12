"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { getOT } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { TIPO_INCIDENCIA } from "@/lib/formato";
import { fotosComoDataUrl, guardarDocumento, prepararEvidencia, tallerParaPdf, validarFirma } from "@/lib/pdf/generar";
import { guardarFotos } from "@/lib/fotos";
import { EntregaPdf } from "@/lib/pdf/plantillas";

class YaEntregada extends Error {}

export async function registrarEntrega(fd: FormData): Promise<{ error?: string }> {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const otId = String(fd.get("otId"));
  const ot = await getOT(s.tid, otId);
  if (!ot) return { error: "Orden no encontrada" };
  if (ot.ot.cerradaEn) return { error: "La orden ya está entregada" };
  // «Retira sin reparar»: el cliente se lleva el coche en cualquier estado, con motivo en el acta
  const sinReparar = fd.get("sinReparar") === "1" ? String(fd.get("motivoSinReparar") ?? "").trim() : null;
  if (sinReparar !== null && sinReparar.length < 3) return { error: "Indica por qué se retira el vehículo sin reparar" };
  if (sinReparar === null && ot.estado.marca !== "listo") return { error: "El vehículo aún no está «Listo para entregar»" };

  const prestamo = await db.query.prestamos.findFirst({ where: and(eq(t.prestamos.tallerId, s.tid), eq(t.prestamos.otId, otId), isNull(t.prestamos.devueltoEn)) });
  if (prestamo) return { error: "Antes de entregar, registra la devolución del coche de sustitución" };

  const firma = validarFirma(fd.get("firma"));
  if (!firma) return { error: "Falta la firma del cliente" };
  const firmante = String(fd.get("firmante") ?? "").trim();
  const trabajos = String(fd.get("trabajos") ?? "").trim() || (sinReparar !== null ? "No se ha realizado ninguna reparación." : "");
  if (firmante.length < 2) return { error: "Indica quién recoge el vehículo" };
  if (trabajos.length < 3) return { error: "Describe los trabajos realizados" };
  const km = fd.get("km") ? Number(fd.get("km")) : null;
  const piezas = String(fd.get("piezas") ?? "").trim() || null;
  const garantia = sinReparar !== null ? "" : String(fd.get("garantia") ?? "").trim();

  const final = ot.estados.find((e) => e.marca === "final");
  if (!final) return { error: "El flujo no tiene estado final configurado" };
  const taller = await tallerPorId(s.tid);
  // Fotos "después": se guardan antes de generar el acta para poder incluirlas
  await guardarFotos(s, fd.getAll("fotos"), { otId, entidad: "entrega", entidadId: otId });
  const fotosDespues = await db.select().from(t.archivos).where(and(eq(t.archivos.tallerId, s.tid), eq(t.archivos.otId, otId), eq(t.archivos.entidad, "entrega")));
  const fotosAntes = ot.archivos.filter((a) => a.entidad === "recepcion");
  const ev = await prepararEvidencia(s, firmante);

  try {
  await db.transaction(async (tx) => {
    const doc = await guardarDocumento(
      tx,
      s,
      ev,
      "entrega",
      otId,
      EntregaPdf({
        taller: tallerParaPdf(taller),
        evidencia: ev,
        numeroOT: ot.ot.numero,
        tipoOrden: ot.tipo.nombre,
        cliente: ot.cliente,
        vehiculo: ot.vehiculo,
        fechaEntrada: ot.ot.fechaEntrada,
        kmEntrada: ot.recepcion?.km ?? null,
        km,
        trabajosRealizados: trabajos,
        piezasSustituidas: piezas,
        incidencias: ot.incidencias
          .filter(({ i }) => i.visibleCliente && i.estado !== "descartada")
          .map(({ i }) => ({ tipo: TIPO_INCIDENCIA[i.tipo], descripcion: i.descripcion, resolucion: i.resolucion })),
        garantia,
        textoLegal: taller.config.textoEntrega ?? "",
        siniestro: ot.ot.datosSiniestro,
        fotosAntes: await fotosComoDataUrl(fotosAntes, 4),
        fotosDespues: await fotosComoDataUrl(fotosDespues, 4),
        totalFotosDespues: fotosDespues.length,
        firmaPng: firma,
        sinReparar,
      }),
    );
    // Solo cierra si sigue abierta (un doble envío no genera dos actas)
    const cerrada = await tx
      .update(t.ordenesTrabajo)
      .set({ estadoId: final.id, cerradaEn: new Date(), actualizadaEn: new Date() })
      .where(and(eq(t.ordenesTrabajo.id, otId), isNull(t.ordenesTrabajo.cerradaEn)))
      .returning({ id: t.ordenesTrabajo.id });
    if (!cerrada.length) throw new YaEntregada();
    await tx.insert(t.entregas).values({ tallerId: s.tid, otId, km, trabajosRealizados: trabajos, piezasSustituidas: piezas, garantiaTexto: garantia, motivoSinReparar: sinReparar, documentoId: doc.id });
    await tx.insert(t.historialEstados).values({
      tallerId: s.tid,
      otId,
      estadoId: final.id,
      usuarioId: s.uid,
      comentario: sinReparar !== null ? `Retirado SIN REPARAR por ${firmante}: ${sinReparar}` : `Entregado a ${firmante}`,
    });
    if (km) await tx.update(t.vehiculos).set({ kmUltimo: km }).where(eq(t.vehiculos.id, ot.vehiculo.id));
  });
  } catch (e) {
    if (e instanceof YaEntregada) return { error: "La orden ya está entregada" };
    throw e;
  }

  await auditar(s, sinReparar !== null ? "retirar_sin_reparar" : "entregar", "ot", otId, { firmante, motivo: sinReparar });
  revalidatePath("/", "layout");
  redirect(`/ot/${otId}?entregada=1`);
}
