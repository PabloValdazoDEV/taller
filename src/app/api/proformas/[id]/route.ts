// PDF de la proforma (no es factura), generado al vuelo con los cobros al día. Solo oficina con permiso de importes.
import { and, asc, eq, isNull } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db, t } from "@/db";
import { getSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { tallerPorId } from "@/lib/taller";
import { tallerParaPdf } from "@/lib/pdf/generar";
import { ProformaPdf, ReciboPdf } from "@/lib/pdf/plantillas";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSesion();
  if (!s || !tiene(s.puestos, "importes")) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const [r] = await db
    .select({ p: t.proformas, ot: t.ordenesTrabajo, cliente: t.clientes, vehiculo: t.vehiculos })
    .from(t.proformas)
    .innerJoin(t.ordenesTrabajo, eq(t.ordenesTrabajo.id, t.proformas.otId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .where(and(eq(t.proformas.tallerId, s.tid), eq(t.proformas.id, id)));
  if (!r) return new Response("No encontrado", { status: 404 });
  const cobros = await db
    .select()
    .from(t.cobros)
    .where(and(eq(t.cobros.tallerId, s.tid), eq(t.cobros.otId, r.ot.id), isNull(t.cobros.anuladoEn)))
    .orderBy(asc(t.cobros.fecha));
  const { p } = r;
  // ?recibo=1 → recibo rápido para el cliente (justificante de pago, no es factura)
  const recibo = new URL(req.url).searchParams.get("recibo") === "1";
  const datos = {
      taller: await tallerParaPdf(await tallerPorId(s.tid)),
      numero: p.numero, numeroOT: r.ot.numero, creadoEn: p.creadoEn, cliente: r.cliente, vehiculo: r.vehiculo,
      lineas: p.lineas, modo: p.ivaModo, pct: p.ivaPct, motivoExencion: p.motivoExencion, preciosConIva: p.preciosConIva,
      base: p.base, iva: p.iva, total: p.total, reparto: p.reparto, facturaExterna: p.facturaExterna,
      cobros: cobros.map((c) => ({ fecha: c.fecha, pagador: c.pagador, metodo: c.metodo, importe: c.importe })),
  };
  const pdf = await renderToBuffer((recibo ? ReciboPdf({ ...datos, emitidoPor: s.nombre }) : ProformaPdf(datos)) as Parameters<typeof renderToBuffer>[0]);
  const nombre = recibo ? `Recibo ${r.ot.numero} ${r.vehiculo.matricula.replace(/\s/g, "")}.pdf` : `Proforma ${p.numero} ${r.vehiculo.matricula.replace(/\s/g, "")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
