import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { BotonLink, Tarjeta, cx } from "./ui";
import type { Periodo } from "@/lib/periodo";

/** Semana / Mes / fechas, anterior y siguiente, y descarga para Excel. `extra`: parámetros que se conservan (filtros). */
export function SelectorPeriodo({ ruta, periodo, extra = "", csv }: { ruta: string; periodo: Periodo; extra?: string; csv?: string }) {
  const con = (q: string) => `${ruta}?${q}${extra ? `&${extra}` : ""}`;
  return (
    <Tarjeta className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Periodo" className="inline-grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
          {(["semana", "mes"] as const).map((x) => (
            <Link
              key={x}
              href={con(`p=${x}&dia=${periodo.tipo === "rango" ? periodo.hasta : periodo.desde}`)}
              aria-current={periodo.tipo === x ? "page" : undefined}
              className={cx("inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-medium", periodo.tipo === x ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
            >
              {x === "semana" ? "Semana" : "Mes"}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {periodo.antes && (
            <Link href={con(periodo.antes)} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Periodo anterior">
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
          )}
          <h2 className="min-w-0 flex-1 text-center font-semibold">{periodo.titulo}</h2>
          {periodo.despues && (
            <Link href={con(periodo.despues)} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Periodo siguiente">
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          )}
        </div>
        {!periodo.actual && (
          <BotonLink variante="fantasma" className="min-h-10 px-3" href={con(`p=${periodo.tipo === "semana" ? "semana" : "mes"}`)}>
            Hoy
          </BotonLink>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <form action={ruta} className="flex flex-wrap items-end gap-2 text-sm">
          {extra.split("&").filter(Boolean).map((kv) => {
            const [k, v] = kv.split("=");
            return <input key={k} type="hidden" name={k} value={decodeURIComponent(v ?? "")} />;
          })}
          <label className="flex flex-col text-xs text-slate-500">
            Desde
            <input type="date" name="desde" defaultValue={periodo.desde} required className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 text-sm text-slate-900" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Hasta
            <input type="date" name="hasta" defaultValue={periodo.hasta} required className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 text-sm text-slate-900" />
          </label>
          <button type="submit" className="min-h-10 rounded-xl px-3 font-semibold text-slate-700 hover:bg-slate-100">Ver</button>
        </form>
        {csv && (
          <a href={csv} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" download>
            <Download className="size-4" aria-hidden /> Descargar para Excel
          </a>
        )}
      </div>
    </Tarjeta>
  );
}

/** Tarjetas de cifras */
export function Cifras({ datos }: { datos: { n: string | number; t: string; detalle?: string; tono?: "rojo" | "verde" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {datos.map((d) => (
        <Tarjeta key={d.t} className="px-3 py-2">
          <div className={cx("text-xl font-bold tabular-nums", d.tono === "rojo" && "text-red-700", d.tono === "verde" && "text-emerald-700")}>{d.n}</div>
          <div className="text-xs text-slate-500">{d.t}</div>
          {d.detalle && <div className="text-[11px] text-slate-400">{d.detalle}</div>}
        </Tarjeta>
      ))}
    </div>
  );
}
