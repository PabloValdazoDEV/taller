"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PREFIJOS, separarTelefono, unirTelefono } from "@/lib/telefono";
import { Input, cx } from "./ui";

/**
 * Teléfono con prefijo internacional (+34 por defecto). Guarda «+34 600 123 456».
 * El prefijo ocupa lo justo (bandera + prefijo, sin partirse); al abrirlo se ve bandera, prefijo y país.
 * Controlado (value/onChange) o para formularios (name + defaultValue).
 */
export function TelefonoInput({
  value,
  defaultValue,
  onChange,
  name,
  className,
  autoFocus,
}: {
  value?: string;
  defaultValue?: string | null;
  onChange?: (v: string) => void;
  name?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  // Sin control externo, el valor completo vive aquí
  const [interno, setInterno] = useState(defaultValue ?? "");
  const actual = value !== undefined ? value : interno;
  // Mientras no hay número, el prefijo elegido se recuerda aparte
  const [prefijoVacio, setPrefijoVacio] = useState(separarTelefono(actual).prefijo);
  const partes = separarTelefono(actual);
  const pref = actual ? partes.prefijo : prefijoVacio;
  const numero = actual ? partes.numero : "";
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const numeroRef = useRef<HTMLInputElement>(null);

  function cambiar(p: string, n: string) {
    setPrefijoVacio(p);
    const v = unirTelefono(p, n);
    setInterno(v);
    onChange?.(v);
  }

  // Cerrar al tocar fuera o con Escape
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const sel = PREFIJOS.find((x) => x.p === pref);
  return (
    <div ref={caja} className={cx("relative grid grid-cols-[max-content_minmax(0,1fr)] gap-2", className)}>
      {name && <input type="hidden" name={name} value={unirTelefono(pref, numero)} />}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); // dentro de <label>: que no salte el foco al número
          setAbierto((v) => !v);
        }}
        aria-label={`Prefijo: ${sel ? `${sel.pais} ${sel.p}` : pref}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={cx(
          "min-h-11 whitespace-nowrap rounded-xl border bg-white px-2 flex items-center justify-center gap-1 text-base font-medium transition",
          abierto ? "border-primary ring-2 ring-primary/20" : "border-slate-300",
        )}
      >
        <span className="text-lg leading-none">{sel?.bandera ?? "🌐"}</span>
        <span className="tabular-nums">{pref}</span>
        <ChevronDown className={cx("size-4 text-slate-400 shrink-0 transition", abierto && "rotate-180")} />
      </button>
      <Input
        ref={numeroRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={numero}
        onChange={(e) => cambiar(pref, e.target.value.replace(/[^\d\s]/g, ""))}
        placeholder="600 123 456"
        className="tabular-nums"
        autoFocus={autoFocus}
      />
      {abierto && (
        <ul
          role="listbox"
          aria-label="País"
          className="absolute left-0 top-full mt-1 z-30 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1"
        >
          {PREFIJOS.map((x) => {
            const activo = x.p === pref;
            return (
              <li key={x.p} role="option" aria-selected={activo}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    cambiar(x.p, numero);
                    setAbierto(false);
                    numeroRef.current?.focus();
                  }}
                  className={cx("w-full min-h-11 px-3 flex items-center gap-3 text-left hover:bg-slate-50", activo && "bg-orange-50")}
                >
                  <span className="text-xl leading-none">{x.bandera}</span>
                  <span className="w-12 font-semibold tabular-nums">{x.p}</span>
                  <span className="flex-1 text-slate-600">{x.pais}</span>
                  {activo && <Check className="size-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
