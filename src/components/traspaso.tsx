"use client";

import { cx } from "./ui";

export type Mecanico = { id: string; nombre: string; color?: string | null };

/** Sugiere quién hace una fase: el mecánico cuyo nombre menciona la fase («Marta (pintura)» → «Pintura»). */
export function sugerirMecanico(mecanicos: Mecanico[], fase: string, actualId: string | null) {
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const palabras = norm(fase).split(/[^a-z]+/).filter((p) => p.length > 3);
  const encaja = mecanicos.find((m) => palabras.some((p) => norm(m.nombre).includes(p)));
  return encaja?.id ?? actualId;
}

/** «¿Quién hace la siguiente fase?»: botones grandes con cada mecánico. */
export function SelectorTraspaso({ mecanicos, valor, onChange, actualId, fase }: { mecanicos: Mecanico[]; valor: string | null; onChange: (id: string | null) => void; actualId: string | null; fase: string }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">¿Quién hace «{fase}»?</p>
      <div className="flex flex-wrap gap-2">
        {mecanicos.map((m) => {
          const on = valor === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(m.id)}
              className={cx("min-h-11 rounded-full px-3 text-sm font-semibold border-2 inline-flex items-center gap-2", on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}
            >
              <span className="size-5 rounded-full grid place-items-center text-[10px] text-white" style={{ background: m.color ?? "#64748b" }}>{m.nombre[0]}</span>
              {m.nombre}
              {m.id === actualId && <span className={cx("text-xs font-normal", on ? "text-slate-300" : "text-slate-400")}>(actual)</span>}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={valor === null}
          onClick={() => onChange(null)}
          className={cx("min-h-11 rounded-full px-3 text-sm font-semibold border-2", valor === null ? "border-slate-900 bg-slate-900 text-white" : "border-dashed border-slate-300 bg-white text-slate-500")}
        >
          Sin asignar
        </button>
      </div>
    </div>
  );
}
