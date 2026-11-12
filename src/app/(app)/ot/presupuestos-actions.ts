"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import type { LineaPresupuesto } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { tallerPorId } from "@/lib/taller";
import { diaISO } from "@/lib/formato";
import { importeLinea, ivaDeOT, leerDecimal, totales } from "@/lib/importes";
import { cambiosAmpliacion } from "@/lib/ampliacion";
import { DIAS_HABILES_VALIDEZ, decidirPresupuesto, sumarDiasHabiles } from "@/lib/presupuestos";
import { validarFirma } from "@/lib/pdf/generar";

type R = { error?: string };

/**
 * Crea un presupuesto con las líneas actuales de la orden. Sustituye al que estuviera pendiente.
 * Si ya hay uno aceptado, es una ampliación (complementario): se enseña qué cambia respecto a él.
 * `horas`: tiempo de trabajo estimado (en una ampliación, el de más); `fecha`: entrega prevista (AAAA-MM-DD).
 */
export async function crearPresupuesto(otId: string, opts: { horas?: string; fecha?: string } = {}): Promise<R & { id?: string }> {
  const s = await requireSesion("importes");
  const horasTxt = (opts.horas ?? "").trim();
  const horas = horasTxt ? leerDecimal(horasTxt) : null;
  if (horas !== null && (!Number.isFinite(horas) || horas < 0 || horas > 9999)) return { error: "Tiempo estimado no válido" };
  const fecha = (opts.fecha ?? "").trim() || null;
  if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))) return { error: "Fecha de entrega no válida" };
  if (fecha && fecha < diaISO()) return { error: "La fecha de entrega no puede ser anterior a hoy" };
  const ot = await db.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.id, otId)) });
  if (!ot) return { error: "Orden no encontrada" };
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  const [cliente, taller, lineas] = await Promise.all([
    db.query.clientes.findFirst({ where: and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, ot.clienteId)) }),
    tallerPorId(s.tid),
    db.select().from(t.lineasOt).where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId))).orderBy(t.lineasOt.orden, t.lineasOt.creadoEn),
  ]);
  if (!lineas.length) return { error: "Añade primero la mano de obra y las piezas" };
  const iva = ivaDeOT(ot, cliente ?? { exentoIva: false, motivoExencion: null }, taller);
  if (iva.modo === "exento" && iva.motivo.trim().length < 5) return { error: "Indica el motivo de la exención de IVA antes de crear el presupuesto" };
  const tot = totales(lineas, iva.modo, iva.pct, iva.preciosConIva);
  const copia: LineaPresupuesto[] = lineas.map((l) => ({
    tipo: l.tipo, especialidad: l.especialidad, referencia: l.referencia, descripcion: l.descripcion,
    cantidad: l.cantidad, precio: l.precio, descuento: l.descuento, importe: importeLinea(l), lineaId: l.id,
  }));
  // Último aceptado: si existe, esto es una ampliación sobre él
  const aceptado = await db.query.presupuestos.findFirst({
    where: and(eq(t.presupuestos.tallerId, s.tid), eq(t.presupuestos.otId, otId), eq(t.presupuestos.estado, "aprobado")),
    orderBy: desc(t.presupuestos.version),
  });
  if (aceptado && aceptado.total === tot.total && cambiosAmpliacion(aceptado.lineas, copia).length === 0)
    return { error: `No hay cambios respecto al presupuesto aceptado ${aceptado.numero}: añade primero lo nuevo en «Importes»` };

  const p = await db.transaction(async (tx) => {
    const [{ version }] = await tx
      .select({ version: sql<number>`coalesce(max(${t.presupuestos.version}), 0) + 1` })
      .from(t.presupuestos)
      .where(and(eq(t.presupuestos.tallerId, s.tid), eq(t.presupuestos.otId, otId)));
    await tx
      .update(t.presupuestos)
      .set({ estado: "sustituido" })
      .where(and(eq(t.presupuestos.tallerId, s.tid), eq(t.presupuestos.otId, otId), eq(t.presupuestos.estado, "pendiente")));
    const [nuevo] = await tx
      .insert(t.presupuestos)
      .values({
        tallerId: s.tid,
        otId,
        numero: `${ot.numero}-P${Number(version)}`,
        version: Number(version),
        tipo: aceptado ? "complementario" : "inicial",
        ampliaId: aceptado?.id ?? null,
        horasEstimadas: horas !== null ? horas.toFixed(2) : null,
        fechaEntrega: fecha,
        lineas: copia,
        ivaModo: iva.modo,
        ivaPct: Number(iva.pct).toFixed(2),
        motivoExencion: iva.modo === "exento" ? iva.motivo : null,
        preciosConIva: iva.preciosConIva,
        base: tot.base,
        iva: tot.iva,
        total: tot.total,
        validezHasta: sumarDiasHabiles(diaISO(), DIAS_HABILES_VALIDEZ),
        creadoPor: s.uid,
      })
      .returning();
    return nuevo;
  });
  await auditar(s, "crear_presupuesto", "ot", otId, { presupuesto: p.numero, total: p.total, amplia: aceptado?.numero ?? null, horas, fecha });
  revalidatePath("/", "layout");
  return { id: p.id };
}

/** Quita un presupuesto que el cliente no ha llegado a aceptar ni rechazar. Su enlace deja de funcionar y su número no se reutiliza. */
export async function borrarPresupuesto(id: string): Promise<R> {
  const s = await requireSesion("importes");
  const r = await db
    .update(t.presupuestos)
    .set({ estado: "borrado" })
    .where(and(eq(t.presupuestos.tallerId, s.tid), eq(t.presupuestos.id, id), inArray(t.presupuestos.estado, ["pendiente", "sustituido"])))
    .returning({ otId: t.presupuestos.otId, numero: t.presupuestos.numero, total: t.presupuestos.total });
  if (!r.length) return { error: "Solo se puede borrar un presupuesto que el cliente no ha aceptado ni rechazado" };
  await auditar(s, "borrar_presupuesto", "ot", r[0].otId, { presupuesto: r[0].numero, total: r[0].total });
  revalidatePath("/", "layout");
  return {};
}

async function presupuestoDeSesion(tid: string, id: string) {
  return db.query.presupuestos.findFirst({ where: and(eq(t.presupuestos.tallerId, tid), eq(t.presupuestos.id, id)) });
}

/** La oficina registra una aprobación sin firma: por teléfono, la aseguradora, el perito… */
export async function aprobarSinFirma(id: string, nombre: string, nota: string): Promise<R> {
  const s = await requireSesion("importes");
  const p = await presupuestoDeSesion(s.tid, id);
  if (!p) return { error: "Presupuesto no encontrado" };
  if (nombre.trim().length < 2) return { error: "Indica quién lo ha aprobado" };
  if (nota.trim().length < 3) return { error: "Indica cómo se ha aprobado (p. ej. «por teléfono» o «autorizado por el perito»)" };
  const r = await decidirPresupuesto({ tid: s.tid, presupuestoId: id, decision: "aprobado", via: "manual", nombre: nombre.trim(), nota, usuario: { uid: s.uid, nombre: s.nombre } });
  revalidatePath(`/ot/${p.otId}`);
  return r.error ? { error: r.error } : {};
}

/** El cliente no acepta el presupuesto (se registra el motivo si lo da). */
export async function rechazarPresupuesto(id: string, nota: string): Promise<R> {
  const s = await requireSesion("importes");
  const p = await presupuestoDeSesion(s.tid, id);
  if (!p) return { error: "Presupuesto no encontrado" };
  const ot = await db.query.ordenesTrabajo.findFirst({ where: eq(t.ordenesTrabajo.id, p.otId) });
  const cliente = ot && (await db.query.clientes.findFirst({ where: eq(t.clientes.id, ot.clienteId) }));
  const r = await decidirPresupuesto({ tid: s.tid, presupuestoId: id, decision: "rechazado", via: "manual", nombre: cliente?.nombre ?? "Cliente", nota, usuario: { uid: s.uid, nombre: s.nombre } });
  revalidatePath(`/ot/${p.otId}`);
  return r.error ? { error: r.error } : {};
}

/** El cliente firma el presupuesto en la tablet del taller. */
export async function aceptarEnTablet(fd: FormData): Promise<R> {
  const s = await requireSesion("importes");
  const id = String(fd.get("presupuestoId") ?? "");
  const p = await presupuestoDeSesion(s.tid, id);
  if (!p) return { error: "Presupuesto no encontrado" };
  const firmante = String(fd.get("firmante") ?? "").trim();
  if (firmante.length < 2) return { error: "Indica el nombre de quien firma" };
  const firma = validarFirma(fd.get("firma"));
  if (!firma) return { error: "Falta la firma del cliente" };
  const r = await decidirPresupuesto({ tid: s.tid, presupuestoId: id, decision: "aprobado", via: "tablet", nombre: firmante, firmaPng: firma, usuario: { uid: s.uid, nombre: s.nombre } });
  if (r.error) return { error: r.error };
  revalidatePath("/", "layout");
  redirect(`/ot/${p.otId}?presupuesto=aceptado`);
}
