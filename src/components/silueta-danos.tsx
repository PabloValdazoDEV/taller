"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Dano, Vista } from "@/db/schema";
import { ESTILOS, VISTAS, defVista, vistaDe, zonaDano, type DefVista, type Forma } from "@/lib/silueta";
import { TIPOS_DANO } from "@/lib/formato";
import { cx } from "./ui";

const COLOR_DANO: Record<string, string> = {
  Arañazo: "#f59e0b",
  Abolladura: "#ef4444",
  Rotura: "#b91c1c",
  Pintura: "#8b5cf6",
  Óxido: "#92400e",
  Otro: "#475569",
};
export const colorDano = (t: string) => COLOR_DANO[t] ?? "#475569";

function FormaSvg({ f }: { f: Forma }) {
  const e = ESTILOS[f.e];
  const p = { fill: e.fill, stroke: e.stroke, strokeWidth: e.sw };
  if (f.t === "path") return <path d={f.d} {...p} />;
  if (f.t === "rect") return <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} {...p} />;
  return <circle cx={f.cx} cy={f.cy} r={f.r} {...p} />;
}

/** Dibujo de una vista con sus marcas. `danos` lleva el número global de cada daño. */
export function VistaSvg({
  def,
  danos,
  onClick,
  onQuitar,
  pendiente,
}: {
  def: DefVista;
  danos: { d: Dano; n: number }[];
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onQuitar?: (n: number) => void;
  pendiente?: { x: number; y: number } | null;
}) {
  const { w, h } = def;
  const pad = 14; // margen para las etiquetas
  const r = Math.max(w, h) * 0.024;
  return (
    <svg viewBox={`0 ${-pad} ${w} ${h + pad * 2}`} className={cx("w-full h-full select-none", onClick && "cursor-crosshair")} onClick={onClick} role="img" aria-label={`Silueta del vehículo: ${def.nombre}`}>
      {def.etiquetas && (
        def.clave === "superior" ? (
          <>
            <text x={w / 2} y={-3} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">{def.etiquetas[0]}</text>
            <text x={w / 2} y={h + 11} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">{def.etiquetas[1]}</text>
          </>
        ) : (
          <>
            <text x={4} y={-3} fontSize="10" fill="#94a3b8" fontWeight="600">{def.etiquetas[0]}</text>
            <text x={w - 4} y={-3} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">{def.etiquetas[1]}</text>
          </>
        )
      )}
      <g transform={def.espejo ? `translate(${w} 0) scale(-1 1)` : undefined}>
        {def.formas.map((f, i) => <FormaSvg key={i} f={f} />)}
      </g>
      {danos.map(({ d, n }) => (
        <g
          key={n}
          transform={`translate(${(d.x / 100) * w} ${(d.y / 100) * h})`}
          onClick={(e) => {
            if (!onQuitar) return;
            e.stopPropagation();
            onQuitar(n);
          }}
          className={onQuitar ? "cursor-pointer" : undefined}
        >
          <circle r={r} fill={colorDano(d.tipo)} stroke="white" strokeWidth={r * 0.22} />
          <text textAnchor="middle" dy={r * 0.38} fontSize={r * 1.1} fontWeight={700} fill="white">{n}</text>
        </g>
      ))}
      {pendiente && <circle cx={(pendiente.x / 100) * w} cy={(pendiente.y / 100) * h} r={r} fill="none" stroke="#0f172a" strokeWidth={2} strokeDasharray="3 2" />}
    </svg>
  );
}

const conNumero = (danos: Dano[]) => danos.map((d, i) => ({ d, n: i + 1 }));

/** Marcado interactivo: elige la vista, toca el dibujo → tipo de daño. Toca un número para quitarlo. */
export function SiluetaDanos({ value, onChange }: { value: Dano[]; onChange: (d: Dano[]) => void }) {
  const [vista, setVista] = useState<Vista>("superior");
  const [pendiente, setPendiente] = useState<{ x: number; y: number } | null>(null);
  const def = defVista(vista);
  const numerados = conNumero(value);

  function clic(e: React.MouseEvent<SVGSVGElement>) {
    // Convierte el punto de pantalla a coordenadas del dibujo (respeta el margen del viewBox)
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const x = Math.round((loc.x / def.w) * 1000) / 10;
    const y = Math.round((loc.y / def.h) * 1000) / 10;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    setPendiente({ x, y });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {VISTAS.map((v) => {
          const n = value.filter((d) => vistaDe(d) === v.clave).length;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={vista === v.clave}
              key={v.clave}
              onClick={() => {
                setVista(v.clave);
                setPendiente(null);
              }}
              className={cx(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 min-h-10 text-sm font-medium border",
                vista === v.clave ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700",
              )}
            >
              <MiniVista def={v} /> {v.corto}
              {n > 0 && <span className={cx("rounded-full px-1.5 text-xs font-bold", vista === v.clave ? "bg-white/25" : "bg-red-100 text-red-700")}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.3fr)_1fr] gap-4 items-start">
        <div className="rounded-2xl bg-white border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-500 mb-1">{def.nombre}</div>
          <div className={cx("mx-auto", vista === "superior" ? "max-w-[230px]" : "w-full")}>
            <VistaSvg
              def={def}
              danos={numerados.filter(({ d }) => vistaDe(d) === vista)}
              onClick={clic}
              pendiente={pendiente}
              onQuitar={(n) => onChange(value.filter((_, j) => j !== n - 1))}
            />
          </div>
        </div>
        <div>
          {pendiente ? (
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">¿Qué tipo de daño?</span>
                <button type="button" onClick={() => setPendiente(null)} aria-label="Cancelar" className="p-1"><X className="size-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_DANO.map((tipo) => (
                  <button
                    type="button"
                    key={tipo}
                    onClick={() => {
                      onChange([...value, { ...pendiente, tipo, vista }]);
                      setPendiente(null);
                    }}
                    className="min-h-11 rounded-xl border border-slate-200 text-sm font-medium flex items-center gap-2 px-3 hover:bg-slate-50"
                  >
                    <span className="size-3 rounded-full" style={{ background: colorDano(tipo) }} /> {tipo}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Elige la vista y toca el dibujo donde haya un daño. Toca un número para quitarlo.</p>
          )}
          <ol className="mt-3 space-y-1.5">
            {numerados.map(({ d, n }) => (
              <li key={n} className="flex items-center gap-2 text-sm">
                <button type="button" onClick={() => setVista(vistaDe(d))} className="size-6 shrink-0 rounded-full grid place-items-center text-white text-xs font-bold" style={{ background: colorDano(d.tipo) }} title="Ver en su vista">
                  {n}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-tight">{d.tipo} <span className="font-normal text-slate-500 text-xs">· {zonaDano(d)}</span></div>
                  <input
                    className="w-full border-b border-slate-200 text-sm px-1 py-0.5 focus:outline-none focus:border-primary bg-transparent"
                    placeholder="Nota (opcional)"
                    value={d.nota ?? ""}
                    onChange={(e) => onChange(value.map((x, j) => (j === n - 1 ? { ...x, nota: e.target.value } : x)))}
                  />
                </div>
              </li>
            ))}
            {value.length === 0 && <li className="text-sm text-slate-400 italic">Sin daños marcados.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}

function MiniVista({ def }: { def: DefVista }) {
  return (
    <svg viewBox={`0 0 ${def.w} ${def.h}`} className={def.clave === "superior" ? "h-5 w-3" : "h-4 w-7"} aria-hidden>
      <g transform={def.espejo ? `translate(${def.w} 0) scale(-1 1)` : undefined}>
        {def.formas.filter((f) => f.e === "carroceria" || f.e === "rueda").map((f, i) => <FormaSvg key={i} f={{ ...f, e: f.e === "rueda" ? "rueda" : "carroceria" } as Forma} />)}
      </g>
    </svg>
  );
}

/** Solo lectura: muestra las vistas con daños (o la superior si no hay ninguno). */
export function VistasDanos({ danos, todas = false }: { danos: Dano[]; todas?: boolean }) {
  const numerados = conNumero(danos);
  const vistas = VISTAS.filter((v) => todas || danos.some((d) => vistaDe(d) === v.clave));
  const mostrar = vistas.length ? vistas : [VISTAS[0]];
  return (
    <div className="grid grid-cols-2 gap-2 items-start">
      {mostrar.map((v) => (
        <div key={v.clave} className={cx("rounded-xl border border-slate-200 bg-white p-1.5", v.clave !== "superior" && mostrar.length > 1 && "col-span-2", mostrar.length === 1 && "col-span-2")}>
          <div className="text-[10px] font-semibold text-slate-500 px-1">{v.nombre}</div>
          <div className={cx("mx-auto", v.clave === "superior" ? "max-w-[110px]" : "w-full")}>
            <VistaSvg def={v} danos={numerados.filter(({ d }) => vistaDe(d) === v.clave)} />
          </div>
        </div>
      ))}
    </div>
  );
}
