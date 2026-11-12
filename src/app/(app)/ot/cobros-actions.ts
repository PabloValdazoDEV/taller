"use server";

import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import type { LineaPresupuesto } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { tallerPorId } from "@/lib/taller";
import { fmtEuros, importeLinea, ivaDeOT, leerDecimal, totales } from "@/lib/importes";
import { METODOS_COBRO, repartoPorDefecto, resumenCobro, type MetodoCobro } from "@/lib/cobros";

type R = { error?: string };

function refrescar(otId: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/ot/${otId}`);
}

const euros = (v: unknown) => {
  const n = leerDecimal(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

/**
 * Proforma con las líneas actuales. Sustituye a la vigente. `clienteEuros`: parte del cliente si paga también una compañía.
 * Si la orden tiene presupuestos y el total supera lo aceptado, hace falta `conformidad`: cómo ha dado el cliente su conformidad.
 */
export async function generarProforma(otId: string, clienteEuros?: string, conformidad?: string): Promise<R> {
  const s = await requireSesion("importes");
  const ot = await db.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.id, otId)) });
  if (!ot) return { error: "Orden no encontrada" };
  if (ot.cerradaEn) return { error: "La orden ya está entregada: su proforma no se puede rehacer" };
  const [cliente, taller, lineas] = await Promise.all([
    db.query.clientes.findFirst({ where: and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, ot.clienteId)) }),
    tallerPorId(s.tid),
    db.select().from(t.lineasOt).where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId))).orderBy(t.lineasOt.orden, t.lineasOt.creadoEn),
  ]);
  if (!lineas.length) return { error: "La orden no tiene importes" };
  const iva = ivaDeOT(ot, cliente ?? { exentoIva: false, motivoExencion: null }, taller);
  if (iva.modo === "exento" && iva.motivo.trim().length < 5) return { error: "Indica el motivo de la exención de IVA" };
  const tot = totales(lineas, iva.modo, iva.pct, iva.preciosConIva);
  if (tot.total < 0) return { error: "El total no puede ser negativo" };
  // ¿Se cobra más de lo que el cliente aceptó en el presupuesto? (RD 1457/1986: lo nuevo necesita su conformidad)
  const exceso = await excesoSobreAceptado(s.tid, otId, tot.total);
  const conforme = conformidad?.trim() || null;
  if (exceso && (!conforme || conforme.length < 3))
    return { error: `El total supera lo aceptado por el cliente${exceso.numero ? ` en el presupuesto ${exceso.numero}` : ""} en ${fmtEuros(exceso.diferencia)}. Indica cómo ha dado su conformidad.` };
  const reparto = repartoPorDefecto(tot.total, ot.datosSiniestro);
  if (reparto.companiaNombre && clienteEuros !== undefined && clienteEuros.trim() !== "") {
    const c = euros(clienteEuros);
    if (!Number.isFinite(c) || c < 0 || c > tot.total) return { error: `La parte del cliente debe estar entre 0 y ${fmtEuros(tot.total)}` };
    reparto.cliente = c;
    reparto.compania = tot.total - c;
  }
  const copia: LineaPresupuesto[] = lineas.map((l) => ({
    tipo: l.tipo, especialidad: l.especialidad, referencia: l.referencia, descripcion: l.descripcion,
    cantidad: l.cantidad, precio: l.precio, descuento: l.descuento, importe: importeLinea(l),
  }));

  const p = await db.transaction(async (tx) => {
    const [{ version }] = await tx
      .select({ version: sql<number>`coalesce(max(${t.proformas.version}), 0) + 1` })
      .from(t.proformas)
      .where(and(eq(t.proformas.tallerId, s.tid), eq(t.proformas.otId, otId)));
    await tx.update(t.proformas).set({ estado: "sustituida" }).where(and(eq(t.proformas.tallerId, s.tid), eq(t.proformas.otId, otId), eq(t.proformas.estado, "vigente")));
    const [nueva] = await tx
      .insert(t.proformas)
      .values({
        tallerId: s.tid, otId, numero: `${ot.numero}-PF${Number(version)}`, version: Number(version), lineas: copia,
        ivaModo: iva.modo, ivaPct: Number(iva.pct).toFixed(2), motivoExencion: iva.modo === "exento" ? iva.motivo : null, preciosConIva: iva.preciosConIva,
        base: tot.base, iva: tot.iva, total: tot.total, reparto, creadoPor: s.uid,
        conformidadExceso: exceso ? conforme!.slice(0, 300) : null,
      })
      .returning();
    return nueva;
  });
  await auditar(s, "crear_proforma", "ot", otId, { proforma: p.numero, total: p.total, reparto, ...(exceso ? { exceso: exceso.diferencia, conformidad: conforme } : {}) });
  refrescar(otId);
  return {};
}

/** Si la orden tiene presupuestos y `total` supera el último aceptado (o no hay ninguno aceptado), cuánto. */
async function excesoSobreAceptado(tid: string, otId: string, total: number) {
  const ps = await db
    .select({ numero: t.presupuestos.numero, total: t.presupuestos.total, estado: t.presupuestos.estado })
    .from(t.presupuestos)
    .where(and(eq(t.presupuestos.tallerId, tid), eq(t.presupuestos.otId, otId), ne(t.presupuestos.estado, "borrado")))
    .orderBy(desc(t.presupuestos.version));
  if (!ps.length) return null; // sin presupuesto (renuncia firmada en el resguardo)
  const aceptado = ps.find((p) => p.estado === "aprobado");
  const diferencia = total - (aceptado?.total ?? 0);
  return diferencia > 0 ? { numero: aceptado?.numero ?? null, diferencia } : null;
}

async function vigente(tid: string, otId: string) {
  return db.query.proformas.findFirst({ where: and(eq(t.proformas.tallerId, tid), eq(t.proformas.otId, otId), eq(t.proformas.estado, "vigente")) });
}

async function cobrosActivos(tid: string, otId: string) {
  return db.select().from(t.cobros).where(and(eq(t.cobros.tallerId, tid), eq(t.cobros.otId, otId), isNull(t.cobros.anuladoEn)));
}

/** Cambia cuánto paga el cliente y cuánto la compañía (sin rehacer la proforma). */
export async function cambiarReparto(otId: string, clienteEuros: string): Promise<R> {
  const s = await requireSesion("importes");
  const p = await vigente(s.tid, otId);
  if (!p) return { error: "Genera primero la proforma" };
  if (!p.reparto.companiaNombre) return { error: "Esta orden no tiene compañía: lo paga todo el cliente" };
  const c = euros(clienteEuros);
  if (!Number.isFinite(c) || c < 0 || c > p.total) return { error: `La parte del cliente debe estar entre 0 y ${fmtEuros(p.total)}` };
  const reparto = { ...p.reparto, cliente: c, compania: p.total - c };
  // No puede quedar cobrado de más a ninguno de los dos
  const r = resumenCobro({ total: p.total, reparto }, await cobrosActivos(s.tid, otId));
  if (r.cliente.pagado > reparto.cliente || r.compania.pagado > reparto.compania) return { error: "Con ese reparto, alguien habría pagado de más. Anula antes el cobro que sobre." };
  await db.update(t.proformas).set({ reparto }).where(eq(t.proformas.id, p.id));
  await auditar(s, "reparto_proforma", "ot", otId, { proforma: p.numero, reparto });
  refrescar(otId);
  return {};
}

/** Apunta un cobro del cliente o de la compañía. */
export async function registrarCobro(fd: FormData): Promise<R> {
  const s = await requireSesion("importes");
  const otId = String(fd.get("otId") ?? "");
  const p = await vigente(s.tid, otId);
  if (!p) return { error: "Genera primero la proforma" };
  const pagador = fd.get("pagador") === "compania" ? "compania" : "cliente";
  const metodo = String(fd.get("metodo") ?? "") as MetodoCobro;
  if (!METODOS_COBRO.includes(metodo)) return { error: "Elige cómo se ha cobrado" };
  const importe = euros(fd.get("importe"));
  if (!Number.isFinite(importe) || importe <= 0) return { error: "Importe no válido" };
  const r = resumenCobro(p, await cobrosActivos(s.tid, otId));
  const pendiente = pagador === "cliente" ? r.cliente.pendiente : r.compania.pendiente;
  if (importe > pendiente) return { error: pendiente === 0 ? "Esa parte ya está cobrada" : `El importe supera lo pendiente (${fmtEuros(pendiente)})` };
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 200) || null;
  const [c] = await db.insert(t.cobros).values({ tallerId: s.tid, otId, proformaId: p.id, pagador, metodo, importe, nota, usuarioId: s.uid }).returning({ id: t.cobros.id });
  await auditar(s, "registrar_cobro", "ot", otId, { cobroId: c.id, pagador, metodo, importe });
  refrescar(otId);
  return {};
}

/** Anula un cobro apuntado por error (no se borra: queda quién y cuándo lo anuló). */
export async function anularCobro(otId: string, cobroId: string): Promise<R> {
  const s = await requireSesion("importes");
  const r = await db
    .update(t.cobros)
    .set({ anuladoEn: new Date(), anuladoPor: s.uid })
    .where(and(eq(t.cobros.tallerId, s.tid), eq(t.cobros.otId, otId), eq(t.cobros.id, cobroId), isNull(t.cobros.anuladoEn)))
    .returning();
  if (!r.length) return { error: "Cobro no encontrado" };
  await auditar(s, "anular_cobro", "ot", otId, { cobroId, importe: r[0].importe });
  refrescar(otId);
  return {};
}

/** Nº de la factura hecha en el programa de facturación (para cruzar datos). */
export async function guardarFacturaExterna(otId: string, numero: string): Promise<R> {
  const s = await requireSesion("importes");
  const p = await vigente(s.tid, otId);
  if (!p) return { error: "Genera primero la proforma" };
  const n = numero.trim().slice(0, 40) || null;
  await db.update(t.proformas).set({ facturaExterna: n }).where(eq(t.proformas.id, p.id));
  await auditar(s, "factura_externa", "ot", otId, { proforma: p.numero, factura: n });
  refrescar(otId);
  return {};
}
