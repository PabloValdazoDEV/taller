// Histórico de coches del periodo para Excel (CSV con «;»). Oficina; los importes solo con permiso de importes.
import { getSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { cochesPeriodo } from "@/lib/historico";
import { csv, leerPeriodo } from "@/lib/periodo";
import { fmtFecha } from "@/lib/formato";
import { clasificar, FILTROS, pasaFiltro, type Filtro } from "@/app/(app)/historico/clasificar";

export async function GET(req: Request) {
  const s = await getSesion();
  if (!s || !tiene(s.puestos, "oficina")) return new Response("No autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const periodo = leerPeriodo(sp, "mes");
  const filtro: Filtro = FILTROS.some((x) => x.v === sp.f) ? (sp.f as Filtro) : "todos";
  const importes = tiene(s.puestos, "importes");
  const filas = clasificar(await cochesPeriodo(s.tid, periodo.desde, periodo.hasta), periodo).filter((o) => pasaFiltro(o, filtro) && (!sp.tipo || o.tipoId === sp.tipo));
  const cuerpo = csv([
    ["Orden", "Matrícula", "Marca", "Modelo", "Cliente", "Compañía", "Tipo de trabajo", "Trabajo", "Entrada", "Salida", "Situación", "Días", "Mecánico", ...(importes ? ["Total (€)", "Nº factura"] : [])],
    ...filas.map((o) => [
      o.numero, o.matricula, o.marca, o.modelo, o.clienteNombre, o.companiaNombre, o.tipoNombre, o.trabajo,
      fmtFecha(o.fechaEntrada), o.cerradaEn && !o.anuladaEn ? fmtFecha(o.cerradaEn) : "",
      o.anuladaEn ? "Anulada" : o.enTaller ? `En el taller (${o.estado})` : o.sinReparar ? "Retirado sin reparar" : "Entregado",
      o.dias, o.mecanico,
      ...(importes ? [o.total != null ? o.total / 100 : null, o.facturaExterna] : []),
    ]),
  ]);
  return new Response(cuerpo, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="historico-${periodo.desde}-a-${periodo.hasta}.csv"` },
  });
}
