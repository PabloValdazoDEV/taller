"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { cx } from "./ui";

/** Caja de búsqueda global (matrícula, teléfono, nombre…). Atajo: tecla «/». */
export function BuscadorGlobal({ valor = "", grande = false, autoFocus = false }: { valor?: string; grande?: boolean; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  return (
    <form action="/buscar" role="search" className="relative">
      <label htmlFor="buscador-global" className="sr-only">Buscar por matrícula, teléfono, nombre o nº de orden</label>
      <Search className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400", grande ? "left-4 size-6" : "left-3 size-5")} aria-hidden />
      <input
        ref={ref}
        id="buscador-global"
        name="q"
        type="search"
        defaultValue={valor}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Matrícula, teléfono, nombre o nº de orden…"
        className={cx(
          "w-full rounded-2xl border border-slate-300 bg-white shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15",
          grande ? "min-h-16 pl-13 pr-24 text-lg" : "min-h-12 pl-10 pr-20 text-base",
        )}
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 md:block">/</kbd>
    </form>
  );
}
