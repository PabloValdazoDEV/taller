"use client";

import { Fuel } from "lucide-react";
import { fmtCombustible } from "@/lib/formato";
import { cx } from "./ui";

const MARCAS = ["Reserva", "1/4", "1/2", "3/4", "Lleno"];

/** Nivel de combustible en octavos (0 = reserva, 8 = lleno) con un deslizador. */
export function SelectorCombustible({ value, onChange, name }: { value: number | null; onChange: (v: number) => void; name?: string }) {
  const v = value ?? 0;
  const pct = (v / 8) * 100;
  const color = v <= 1 ? "#dc2626" : v <= 3 ? "#f59e0b" : "#10b981";
  return (
    <div>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <div className="flex items-center gap-3">
        <Fuel className="size-5 shrink-0" style={{ color: value == null ? "#94a3b8" : color }} />
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={v}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerDown={() => value == null && onChange(v)}
            aria-label="Nivel de combustible"
            className={cx("deposito w-full h-10 cursor-pointer", value == null && "opacity-50")}
            style={{ ["--relleno" as string]: `${pct}%`, ["--color" as string]: color }}
          />
          <div className="flex justify-between text-[11px] text-slate-400 -mt-1 select-none">
            {MARCAS.map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>
        <span className={cx("w-20 text-right font-semibold tabular-nums", value == null ? "text-slate-400 text-sm" : "text-lg")}>
          {value == null ? "Desliza" : fmtCombustible(value)}
        </span>
      </div>
    </div>
  );
}
