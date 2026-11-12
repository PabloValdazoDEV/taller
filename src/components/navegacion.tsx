"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, ClipboardPlus, House, KanbanSquare, Users, Wrench } from "lucide-react";
import type { Rol } from "@/lib/session-token";

const ITEMS = [
  { href: "/", texto: "Inicio", corto: "Inicio", icono: House, roles: ["admin", "asesor", "jefe_taller"] },
  { href: "/recepcion/nueva", texto: "Nueva recepción", corto: "Recepción", icono: ClipboardPlus, roles: ["admin", "asesor", "jefe_taller"] },
  { href: "/tablero", texto: "Tablero", corto: "Tablero", icono: KanbanSquare, roles: ["admin", "asesor", "jefe_taller", "mecanico"] },
  { href: "/clientes", texto: "Clientes", corto: "Clientes", icono: Users, roles: ["admin", "asesor", "jefe_taller"] },
  { href: "/mis-trabajos", texto: "Mis trabajos", corto: "Mis trabajos", icono: Wrench, roles: ["mecanico", "jefe_taller"] },
  { href: "/sustitucion", texto: "Coches sustitución", corto: "Sustitución", icono: Car, roles: ["admin", "asesor", "jefe_taller"] },
] as const;

export function Navegacion({ rol, variante, plegada = false }: { rol: Rol; variante: "lateral" | "inferior"; plegada?: boolean }) {
  const ruta = usePathname();
  const items = ITEMS.filter((i) => (i.roles as readonly string[]).includes(rol));
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

  if (variante === "lateral")
    return (
      <nav className="p-3 space-y-1">
        {items.map(({ href, texto, icono: I }) => (
          <Link
            key={href}
            href={href}
            title={plegada ? texto : undefined}
            aria-label={plegada ? texto : undefined}
            className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium ${plegada ? "justify-center px-0" : "px-3"} ${activo(href) ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"}`}
          >
            <I className="size-5 shrink-0" /> {!plegada && texto}
          </Link>
        ))}
      </nav>
    );

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(({ href, corto, icono: I }) => (
        <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-0.5 min-h-14 py-1.5 text-[11px] leading-tight font-medium ${activo(href) ? "text-primary" : "text-slate-500"}`}>
          <I className="size-6" />
          <span className="truncate max-w-full px-0.5">{corto}</span>
        </Link>
      ))}
    </nav>
  );
}
