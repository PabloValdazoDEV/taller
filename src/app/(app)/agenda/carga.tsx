import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Tarjeta, cx } from "@/components/ui";
import { NOMBRE_ESPECIALIDAD } from "@/lib/importes";
import { fmtH } from "@/lib/capacidad";
import type { CargaDia, Nivel } from "@/lib/carga";

export const PUNTO: Record<Nivel, { clase: string; texto: string }> = {
  libre: { clase: "bg-emerald-500", texto: "Hay hueco" },
  justo: { clase: "bg-amber-400", texto: "Va justo" },
  lleno: { clase: "bg-red-600", texto: "No se da abasto" },
  cerrado: { clase: "bg-slate-300", texto: "Cerrado" },
};

const color = (ratio: number) => (ratio > 1.001 ? "bg-red-600" : ratio >= 0.85 ? "bg-amber-400" : "bg-emerald-500");

function Barra({ etiqueta, valor, total, texto }: { etiqueta: string; valor: number; total: number; texto: string }) {
  const ratio = total ? valor / total : valor ? 2 : 0;
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
      <span className="truncate text-slate-600">{etiqueta}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${etiqueta}: ${texto}`}>
        <span className={cx("block h-full rounded-full", color(ratio))} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </span>
      <span className={cx("text-right tabular-nums", ratio > 1.001 ? "font-semibold text-red-700" : "text-slate-700")}>{texto}</span>
    </div>
  );
}

/** Cómo va el día: horas por especialidad, plazas, coches de sustitución y recepciones por franja. */
export function CargaDelDia({ c }: { c: CargaDia }) {
  const libres = c.sustitucion.total - c.sustitucion.ocup;
  const problemas = c.avisos.filter((a) => !a.startsWith("El taller"));
  return (
    <Tarjeta className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Carga del día</h3>
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <span className={cx("size-2.5 rounded-full", PUNTO[c.nivel].clase)} aria-hidden /> {PUNTO[c.nivel].texto}
        </span>
      </div>
      {!c.abierto && <p className="text-sm text-slate-600">El taller no abre este día.</p>}
      {problemas.length > 0 && (
        <div className="flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <ul className="space-y-0.5">{problemas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      <div className="space-y-2">
        {c.horas.map((h) => (
          <Barra key={h.esp} etiqueta={NOMBRE_ESPECIALIDAD[h.esp]} valor={h.ocup} total={h.disp} texto={`${fmtH(h.ocup)} de ${fmtH(h.disp)} h`} />
        ))}
        {c.horas.length === 0 && <p className="text-sm text-slate-500">No hay mecánicos con horas este día.</p>}
        {c.plazas ? (
          <Barra etiqueta="Plazas" valor={c.plazas.ocup} total={c.plazas.total} texto={`${c.plazas.ocup} de ${c.plazas.total}`} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>
          Coches de sustitución:{" "}
          <b className={cx("font-semibold", libres < 0 ? "text-red-700" : "text-slate-900")}>
            {libres < 0 ? `faltan ${-libres}` : `${libres} libre${libres === 1 ? "" : "s"}`}
          </b>{" "}
          de {c.sustitucion.total}
        </span>
        {c.porValorar > 0 && (
          <span>
            Por valorar: <b className="font-semibold text-slate-900">{c.porValorar} coche{c.porValorar === 1 ? "" : "s"}</b> <span className="text-slate-400">(aún sin horas)</span>
          </span>
        )}
        {c.maxPorFranja ? (
          <span>
            Recepciones:{" "}
            {c.franjas
              .filter((f) => f.n > 0)
              .map((f) => (
                <span key={f.id} className={cx("mr-2 whitespace-nowrap", f.n > c.maxPorFranja! ? "font-semibold text-red-700" : f.n === c.maxPorFranja ? "font-semibold text-amber-800" : "")}>
                  {f.nombre.toLowerCase()} {f.n}/{c.maxPorFranja}
                </span>
              ))}
            {c.franjas.every((f) => f.n === 0) && "ninguna"}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-400">
        Estimación con las horas previstas de los coches que ya están en el taller y de las citas. Solo avisa: siempre se puede meter un coche más.{" "}
        {(!c.plazas || !c.maxPorFranja) && (
          <Link href="/configuracion/capacidad" className="underline">
            Ajustar capacidad
          </Link>
        )}
      </p>
    </Tarjeta>
  );
}
