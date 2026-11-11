"use client";

import { Fuel } from "lucide-react";
import { cx } from "./ui";

const NIVELES = [
  { v: 0, t: "Reserva" },
  { v: 2, t: "1/4" },
  { v: 4, t: "1/2" },
  { v: 6, t: "3/4" },
  { v: 8, t: "Lleno" },
];

export function SelectorCombustible({ value, onChange, name }: { value: number | null; onChange: (v: number) => void; name?: string }) {
  return (
    <div>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <div className="flex items-center gap-2">
        <Fuel className="size-5 text-slate-500 shrink-0" />
        <div className="grid grid-cols-5 gap-1.5 flex-1">
          {NIVELES.map((n) => (
            <button
              type="button"
              key={n.v}
              onClick={() => onChange(n.v)}
              className={cx(
                "min-h-11 rounded-xl border text-sm font-semibold transition",
                value === n.v ? "bg-primary text-white border-primary" : "bg-white border-slate-300 text-slate-700",
              )}
            >
              {n.t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all" style={{ width: `${((value ?? 0) / 8) * 100}%` }} />
      </div>
    </div>
  );
}
