"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Car, ClipboardPlus, House, KanbanSquare, Menu, Settings, Users, Wrench, X } from "lucide-react";
import { tiene, type Permiso, type Puesto } from "@/lib/puestos";
import { cx } from "./ui";

const ITEMS: { href: string; texto: string; corto?: string; icono: typeof House; permiso: Permiso }[] = [
  { href: "/", texto: "Inicio", icono: House, permiso: "oficina" },
  { href: "/recepcion/nueva", texto: "Nueva recepción", corto: "Recibir", icono: ClipboardPlus, permiso: "recepcion" },
  { href: "/mis-trabajos", texto: "Mis trabajos", icono: Wrench, permiso: "misTrabajos" },
  { href: "/tablero", texto: "Tablero", icono: KanbanSquare, permiso: "tablero" },
  { href: "/clientes", texto: "Clientes", icono: Users, permiso: "clientes" },
  { href: "/sustitucion", texto: "Coches sustitución", corto: "Sustitución", icono: Car, permiso: "sustitucion" },
  { href: "/configuracion", texto: "Configuración", icono: Settings, permiso: "configuracion" },
];

/** En el móvil caben 4 accesos + «Más». */
const MAX_INFERIOR = 4;

export function Navegacion({ puestos, variante, plegada = false }: { puestos: Puesto[]; variante: "lateral" | "inferior"; plegada?: boolean }) {
  const ruta = usePathname();
  const [masAbierto, setMasAbierto] = useState(false);
  useEffect(() => setMasAbierto(false), [ruta]);

  // Un mecánico puro no necesita «Inicio» de oficina: su inicio es «Mis trabajos».
  const items = ITEMS.filter((i) => tiene(puestos, i.permiso));
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));

  if (variante === "lateral")
    return (
      <nav className="p-3 space-y-1" aria-label="Menú principal">
        {items.map(({ href, texto, icono: I }) => (
          <Link
            key={href}
            href={href}
            title={plegada ? texto : undefined}
            aria-label={plegada ? texto : undefined}
            aria-current={activo(href) ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors",
              plegada ? "justify-center px-0" : "px-3",
              activo(href) ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <I className="size-5 shrink-0" aria-hidden /> {!plegada && texto}
          </Link>
        ))}
      </nav>
    );

  const visibles = items.length > MAX_INFERIOR + 1 ? items.slice(0, MAX_INFERIOR) : items;
  const resto = items.length > MAX_INFERIOR + 1 ? items.slice(MAX_INFERIOR) : [];
  const restoActivo = resto.some((i) => activo(i.href));
  const columnas = visibles.length + (resto.length ? 1 : 0);

  return (
    <>
      {masAbierto && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40" onClick={() => setMasAbierto(false)} aria-hidden />
      )}
      {masAbierto && (
        <div role="dialog" aria-label="Más opciones" className="md:hidden fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-50 mx-3 mb-2 rounded-2xl bg-white shadow-xl border border-slate-200 p-2">
          {resto.map(({ href, texto, icono: I }) => (
            <Link
              key={href}
              href={href}
              aria-current={activo(href) ? "page" : undefined}
              className={cx("flex items-center gap-3 rounded-xl px-3 min-h-12 text-base font-medium", activo(href) ? "bg-slate-100 text-slate-900" : "text-slate-700")}
            >
              <I className="size-5" aria-hidden /> {texto}
            </Link>
          ))}
        </div>
      )}
      <nav
        aria-label="Menú principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 grid pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${columnas}, 1fr)` }}
      >
        {visibles.map(({ href, texto, corto, icono: I }) => (
          <Link
            key={href}
            href={href}
            aria-current={activo(href) ? "page" : undefined}
            className={cx("flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium", activo(href) ? "text-slate-900" : "text-slate-500")}
          >
            <I className={cx("size-6", activo(href) && "stroke-[2.5]")} aria-hidden />
            <span className="truncate max-w-full px-1">{corto ?? texto}</span>
          </Link>
        ))}
        {resto.length > 0 && (
          <button
            type="button"
            onClick={() => setMasAbierto((v) => !v)}
            aria-expanded={masAbierto}
            className={cx("flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium", masAbierto || restoActivo ? "text-slate-900" : "text-slate-500")}
          >
            {masAbierto ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
            <span>Más</span>
          </button>
        )}
      </nav>
    </>
  );
}
