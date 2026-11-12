"use client";

import { useState } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Navegacion } from "./navegacion";
import { cx } from "./ui";
import { salir } from "@/app/login/actions";
import type { Puesto } from "@/lib/puestos";
import { COOKIE_BARRA } from "@/lib/constantes";


/** Barra lateral (escritorio/tablet). Se puede plegar a solo iconos; se recuerda en una cookie. */
export function BarraLateral({ taller, logo, nombre, puestosNombre, puestos, plegadaInicial }: { taller: string; logo: string | null; nombre: string; puestosNombre: string; puestos: Puesto[]; plegadaInicial: boolean }) {
  const [plegada, setPlegada] = useState(plegadaInicial);

  function alternar() {
    const v = !plegada;
    setPlegada(v);
    document.cookie = `${COOKIE_BARRA}=${v ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside className={cx("hidden md:flex shrink-0 flex-col bg-slate-900 text-slate-200 sticky top-0 h-dvh transition-[width] duration-200", plegada ? "w-[72px]" : "w-60")}>
      <div className={cx("border-b border-white/10 flex items-center gap-2 min-h-[72px]", plegada ? "justify-center px-2" : "px-5 justify-between")}>
        {!plegada && (
          <div className="min-w-0 flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5" />
            )}
            <div className="min-w-0">
              <div className="text-white font-bold leading-tight truncate">{taller}</div>
              <div className="text-xs text-slate-400">Gestión de taller</div>
            </div>
          </div>
        )}
        <button
          onClick={alternar}
          className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
          aria-label={plegada ? "Mostrar menú" : "Esconder menú"}
          title={plegada ? "Mostrar menú" : "Esconder menú"}
        >
          {plegada ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
      </div>
      <Navegacion puestos={puestos} variante="lateral" plegada={plegada} />
      <div className={cx("mt-auto p-4 border-t border-white/10 flex items-center", plegada ? "justify-center" : "justify-between")}>
        {!plegada && (
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{nombre}</div>
            <div className="text-xs text-slate-400 truncate" title={puestosNombre}>{puestosNombre}</div>
          </div>
        )}
        <form action={salir}>
          <button className="p-2 rounded-lg hover:bg-white/10" aria-label="Cambiar de usuario" title={`${nombre} · Cambiar de usuario`}>
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </aside>
  );
}
