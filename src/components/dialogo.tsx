"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Ventana modal accesible basada en <dialog> nativo: atrapa el foco, se cierra con Esc y
 * en el móvil ocupa toda la pantalla (hoja inferior) para que el teclado no tape el formulario.
 */
export function Dialogo({ abierto, onCerrar, titulo, descripcion, children }: { abierto: boolean; onCerrar: () => void; titulo: string; descripcion?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      aria-labelledby="dialogo-titulo"
      className="m-0 mt-auto w-full max-w-none max-h-[92dvh] rounded-t-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 sm:m-auto sm:max-w-xl sm:rounded-2xl"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 id="dialogo-titulo" className="text-lg font-semibold">{titulo}</h2>
          {descripcion && <p className="text-sm text-slate-500">{descripcion}</p>}
        </div>
        <button type="button" onClick={onCerrar} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-5 py-4">{abierto && children}</div>
    </dialog>
  );
}
