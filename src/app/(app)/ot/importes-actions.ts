"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { tallerPorId } from "@/lib/taller";
import { ESPECIALIDADES, TIPOS_LINEA, convertirPrecio, ivaDeOT, leerDecimal } from "@/lib/importes";

type R = { error?: string };

/** La orden del taller de la sesión, si se pueden tocar sus importes (abierta). */
async function otEditable(tid: string, otId: string) {
  const ot = await db.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, tid), eq(t.ordenesTrabajo.id, otId)) });
  if (!ot) return { error: "Orden no encontrada" } as const;
  if (ot.cerradaEn) return { error: "La orden ya está cerrada: sus importes no se pueden cambiar" } as const;
  return { ot } as const;
}

function refrescar(otId: string) {
  revalidatePath(`/ot/${otId}`);
}

const LineaZ = z
  .object({
    tipo: z.enum(TIPOS_LINEA),
    especialidad: z.enum(ESPECIALIDADES).nullable(),
    referencia: z.string().trim().max(60, "Referencia demasiado larga").nullable(),
    descripcion: z.string().trim().min(2, "Escribe la descripción").max(200, "Descripción demasiado larga"),
    cantidad: z.number({ invalid_type_error: "Cantidad no válida" }).refine((n) => Number.isFinite(n) && n > 0 && n <= 100_000, "La cantidad debe ser mayor que 0"),
    precio: z.number({ invalid_type_error: "Precio no válido" }).refine((n) => Number.isFinite(n) && Math.abs(n) <= 1_000_000, "Precio no válido"),
    descuento: z.number().refine((n) => Number.isFinite(n) && n >= 0 && n <= 100, "El descuento va de 0 a 100 %"),
  })
  .refine((l) => l.tipo !== "mano_obra" || l.especialidad, { message: "Elige la especialidad", path: ["especialidad"] })
  // Solo «otro concepto» admite importes negativos (p. ej. un descuento general o un abono)
  .refine((l) => l.precio >= 0 || l.tipo === "otro", { message: "El precio no puede ser negativo (usa «Otro concepto» para un descuento)", path: ["precio"] });

const txt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s || null;
};

/** Crea o edita una línea de importe. */
export async function guardarLinea(fd: FormData): Promise<R> {
  const s = await requireSesion("importes");
  const otId = String(fd.get("otId") ?? "");
  const c = await otEditable(s.tid, otId);
  if ("error" in c) return { error: c.error };

  const tipo = String(fd.get("tipo") ?? "");
  const v = LineaZ.safeParse({
    tipo,
    especialidad: tipo === "mano_obra" ? txt(fd.get("especialidad")) : null,
    referencia: tipo === "pieza" ? txt(fd.get("referencia")) : null,
    descripcion: String(fd.get("descripcion") ?? ""),
    cantidad: leerDecimal(fd.get("cantidad")),
    precio: leerDecimal(fd.get("precio")),
    descuento: txt(fd.get("descuento")) ? leerDecimal(fd.get("descuento")) : 0,
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const d = v.data;
  const valores = {
    tipo: d.tipo,
    especialidad: d.especialidad,
    referencia: d.referencia,
    descripcion: d.descripcion,
    cantidad: d.cantidad.toFixed(2),
    precio: d.precio.toFixed(4),
    descuento: d.descuento.toFixed(2),
  };

  const id = txt(fd.get("id"));
  if (id) {
    const r = await db
      .update(t.lineasOt)
      .set({ ...valores, actualizadoEn: new Date() })
      .where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId), eq(t.lineasOt.id, id)))
      .returning({ id: t.lineasOt.id });
    if (!r.length) return { error: "Línea no encontrada" };
    await auditar(s, "editar_linea", "ot", otId, { lineaId: id, ...valores });
  } else {
    const [{ siguiente }] = await db
      .select({ siguiente: sql<number>`coalesce(max(${t.lineasOt.orden}), 0) + 1` })
      .from(t.lineasOt)
      .where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId)));
    const [l] = await db
      .insert(t.lineasOt)
      .values({ tallerId: s.tid, otId, orden: Number(siguiente), creadoPor: s.uid, ...valores })
      .returning({ id: t.lineasOt.id });
    await auditar(s, "crear_linea", "ot", otId, { lineaId: l.id, ...valores });
  }
  refrescar(otId);
  return {};
}

export async function borrarLinea(otId: string, lineaId: string): Promise<R> {
  const s = await requireSesion("importes");
  const c = await otEditable(s.tid, otId);
  if ("error" in c) return { error: c.error };
  const r = await db
    .delete(t.lineasOt)
    .where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId), eq(t.lineasOt.id, lineaId)))
    .returning();
  if (!r.length) return { error: "Línea no encontrada" };
  await auditar(s, "borrar_linea", "ot", otId, { linea: r[0] });
  refrescar(otId);
  return {};
}

/** Con IVA o exento (con su motivo legal). */
export async function configurarIva(otId: string, modo: "con_iva" | "exento", motivo?: string): Promise<R> {
  const s = await requireSesion("importes");
  const c = await otEditable(s.tid, otId);
  if ("error" in c) return { error: c.error };
  const m = motivo?.trim() ?? "";
  if (modo === "exento" && m.length < 5) return { error: "Indica el motivo legal de la exención: saldrá en el presupuesto y la proforma" };

  await db.transaction(async (tx) => {
    // Un trabajo exento no tiene «IVA incluido»: si los precios estaban con IVA, se pasan a importe final sin él
    if (modo === "exento" && c.ot.preciosConIva) {
      const taller = await tallerPorId(s.tid);
      const pct = c.ot.ivaPct ?? taller.ivaDefecto;
      const lineas = await tx.select().from(t.lineasOt).where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId)));
      for (const l of lineas) await tx.update(t.lineasOt).set({ precio: convertirPrecio(l.precio, pct, false).toFixed(4) }).where(eq(t.lineasOt.id, l.id));
    }
    await tx
      .update(t.ordenesTrabajo)
      .set({ ivaModo: modo, motivoExencion: modo === "exento" ? m : null, ...(modo === "exento" ? { preciosConIva: false } : {}), actualizadaEn: new Date() })
      .where(and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.id, otId)));
  });
  await auditar(s, "iva_orden", "ot", otId, { modo, motivo: modo === "exento" ? m : null });
  refrescar(otId);
  return {};
}

/** Cambia cómo se teclean los precios (sin IVA / IVA incluido) y convierte los de las líneas que ya hay. */
export async function cambiarPreciosConIva(otId: string, conIva: boolean): Promise<R> {
  const s = await requireSesion("importes");
  const c = await otEditable(s.tid, otId);
  if ("error" in c) return { error: c.error };
  const taller = await tallerPorId(s.tid);
  const cliente = await db.query.clientes.findFirst({ where: and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, c.ot.clienteId)) });
  const iva = ivaDeOT(c.ot, cliente ?? { exentoIva: false, motivoExencion: null }, taller);
  if (iva.modo === "exento") return { error: "En un trabajo exento los precios ya son el importe final" };
  if (c.ot.preciosConIva === conIva) return {};

  await db.transaction(async (tx) => {
    const lineas = await tx.select().from(t.lineasOt).where(and(eq(t.lineasOt.tallerId, s.tid), eq(t.lineasOt.otId, otId)));
    for (const l of lineas) await tx.update(t.lineasOt).set({ precio: convertirPrecio(l.precio, iva.pct, conIva).toFixed(4) }).where(eq(t.lineasOt.id, l.id));
    await tx.update(t.ordenesTrabajo).set({ preciosConIva: conIva, actualizadaEn: new Date() }).where(and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.id, otId)));
  });
  await auditar(s, "precios_con_iva", "ot", otId, { conIva });
  refrescar(otId);
  return {};
}
