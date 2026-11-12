import Link from "next/link";
import { requireSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { cochesPeriodo } from "@/lib/historico";
import { leerPeriodo, paramsPeriodo } from "@/lib/periodo";
import { fmtFecha } from "@/lib/formato";
import { fmtEuros } from "@/lib/importes";
import { Matricula, Pastilla, Tarjeta, Vacio, cx } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { Cifras, SelectorPeriodo } from "@/components/selector-periodo";
import { FILTROS, clasificar, pasaFiltro, type Filtro } from "./clasificar";

export const dynamic = "force-dynamic";

const dias = (n: number) => (n === 0 ? "el mismo día" : n === 1 ? "1 día" : `${n} días`);

export default async function Historico({ searchParams }: { searchParams: Promise<{ p?: string; dia?: string; desde?: string; hasta?: string; f?: string; tipo?: string }> }) {
  const s = await requireSesion("oficina");
  const sp = await searchParams;
  const periodo = leerPeriodo(sp, "mes");
  const filtro: Filtro = FILTROS.some((x) => x.v === sp.f) ? (sp.f as Filtro) : "todos";
  const verImportes = tiene(s.puestos, "importes");
  const todas = clasificar(await cochesPeriodo(s.tid, periodo.desde, periodo.hasta), periodo);
  const validas = todas.filter((o) => !o.anuladaEn);

  const entregados = validas.filter((o) => o.salio);
  const media = entregados.length ? entregados.reduce((a, o) => a + o.dias, 0) / entregados.length : null;
  const tipos = [...new Map(validas.map((o) => [o.tipoId, { id: o.tipoId, nombre: o.tipoNombre, color: o.tipoColor, n: validas.filter((x) => x.tipoId === o.tipoId).length }])).values()].sort((a, b) => b.n - a.n);
  const lista = todas.filter((o) => pasaFiltro(o, filtro) && (!sp.tipo || o.tipoId === sp.tipo));
  const facturado = entregados.reduce((a, o) => a + (o.total ?? 0), 0);

  const base = paramsPeriodo(periodo);
  const enlace = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(base);
    const actual = { f: filtro === "todos" ? null : filtro, tipo: sp.tipo ?? null, ...cambios };
    for (const [k, v] of Object.entries(actual)) if (v) q.set(k, v);
    return `/historico?${q}`;
  };
  const extra = new URLSearchParams(Object.entries({ f: filtro === "todos" ? "" : filtro, tipo: sp.tipo ?? "" }).filter(([, v]) => v)).toString();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-slate-500">Coches que han pasado por el taller: cuándo entraron, cuándo se entregaron y cuánto estuvieron.</p>
      </div>
      <SelectorPeriodo ruta="/historico" periodo={periodo} extra={extra} csv={`/api/historico?${base}${extra ? `&${extra}` : ""}`} />

      <Cifras
        datos={[
          { n: validas.filter((o) => o.entro).length, t: "entraron" },
          { n: entregados.length, t: "entregados", detalle: entregados.some((o) => o.sinReparar) ? `${entregados.filter((o) => o.sinReparar).length} sin reparar` : undefined },
          { n: validas.filter((o) => o.enTaller).length, t: "siguen en el taller" },
          { n: media == null ? "—" : media.toLocaleString("es-ES", { maximumFractionDigits: 1 }), t: "días de media", detalle: "de los entregados" },
          { n: new Set(validas.map((o) => o.matricula)).size, t: "coches distintos" },
          verImportes ? { n: fmtEuros(facturado), t: "de los entregados", detalle: "según proforma" } : { n: todas.length - validas.length, t: "anuladas" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map((x) => (
          <Link key={x.v} href={enlace({ f: x.v === "todos" ? null : x.v })} aria-current={filtro === x.v ? "page" : undefined} className={cx("inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium", filtro === x.v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}>
            {x.t}
          </Link>
        ))}
        {tipos.length > 1 && <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden />}
        {tipos.length > 1 &&
          tipos.map((tp) => (
            <Link key={tp.id} href={enlace({ tipo: sp.tipo === tp.id ? null : tp.id })} aria-current={sp.tipo === tp.id ? "page" : undefined} className={cx("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm", sp.tipo === tp.id ? "border-slate-900 bg-slate-100 font-semibold" : "border-slate-200 bg-white text-slate-700")}>
              <span className="size-2.5 rounded-full" style={{ background: tp.color }} aria-hidden /> {tp.nombre} <span className="text-slate-400">{tp.n}</span>
            </Link>
          ))}
      </div>

      {lista.length === 0 ? (
        <Tarjeta><Vacio>No hay coches con este filtro en el periodo.</Vacio></Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-slate-100">
          {lista.map((o) => (
            <Link key={o.id} href={`/ot/${o.id}`} className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-slate-50", o.anuladaEn && "opacity-50")}>
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Matricula>{o.matricula}</Matricula>
                  {o.marca && <LogoMarca marca={o.marca} className="size-4" />}
                  <span className="text-sm text-slate-600">{[o.marca, o.modelo].filter(Boolean).join(" ")}</span>
                  <Pastilla color={o.tipoColor}>{o.tipoNombre}</Pastilla>
                  {o.anuladaEn && <Pastilla color="#64748b">Anulada</Pastilla>}
                  {o.sinReparar && <Pastilla color="#b45309">Sin reparar</Pastilla>}
                </div>
                <div className="truncate text-sm">
                  <span className="font-medium">{o.clienteNombre}</span>
                  {o.companiaNombre && <span className="text-slate-500"> · {o.companiaNombre}</span>}
                  <span className="text-slate-400"> · {o.numero}</span>
                </div>
                <div className="truncate text-xs text-slate-500">{o.trabajo}</div>
              </div>
              <div className="text-sm sm:text-right">
                <div>
                  Entró <b className="font-semibold">{fmtFecha(o.fechaEntrada)}</b>
                  {o.cerradaEn && !o.anuladaEn ? (
                    <> · {o.sinReparar ? "Retirado" : "Entregado"} <b className="font-semibold">{fmtFecha(o.cerradaEn)}</b></>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {o.enTaller ? <span className="font-semibold text-sky-800">En el taller · {dias(o.dias)} · {o.estado}</span> : o.anuladaEn ? "Anulada" : `Estuvo ${dias(o.dias)}`}
                  {o.mecanico && ` · ${o.mecanico}`}
                </div>
                {verImportes && o.total != null && (
                  <div className="text-xs">
                    <b className="tabular-nums">{fmtEuros(o.total)}</b> {o.facturaExterna ? <span className="text-emerald-700">· Factura {o.facturaExterna}</span> : !o.enTaller && <span className="text-slate-400">· sin nº de factura</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
