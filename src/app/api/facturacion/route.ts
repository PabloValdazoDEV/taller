// Trabajos del periodo para la gestoría o el programa de facturación (CSV con «;» para Excel). Dirección y facturación.
import { getSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { facturacionPeriodo } from "@/lib/historico";
import { csv, leerPeriodo } from "@/lib/periodo";
import { fmtFecha } from "@/lib/formato";

const e = (c: number) => c / 100;

export async function GET(req: Request) {
  const s = await getSesion();
  if (!s || !tiene(s.puestos, "facturacion")) return new Response("No autorizado", { status: 401 });
  const periodo = leerPeriodo(Object.fromEntries(new URL(req.url).searchParams), "mes");
  const { proformas } = await facturacionPeriodo(s.tid, periodo.desde, periodo.hasta);
  const cuerpo = csv([
    ["Fecha", "Orden", "Proforma", "Matrícula", "Cliente", "NIF cliente", "IVA", "Base (€)", "IVA (€)", "Total (€)", "Paga cliente (€)", "Compañía", "Paga compañía (€)", "Cobrado (€)", "Pendiente (€)", "Nº factura"],
    ...proformas.map((p) => [
      fmtFecha(p.fecha), p.otNumero, p.numero, p.matricula, p.clienteNombre, p.clienteNif, p.ivaModo === "exento" ? "Exento" : "Con IVA",
      e(p.base), e(p.iva), e(p.total), e(p.reparto.cliente), p.reparto.companiaNombre, e(p.reparto.compania),
      e(p.cobradoCliente + p.cobradoCompania), e(p.pendienteCliente + p.pendienteCompania), p.facturaExterna,
    ]),
  ]);
  return new Response(cuerpo, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="facturacion-${periodo.desde}-a-${periodo.hasta}.csv"` },
  });
}
