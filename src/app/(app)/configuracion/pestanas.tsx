"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Car, Users } from "lucide-react";
import { cx } from "@/components/ui";

const PESTANAS = [
  { href: "/configuracion/empleados", texto: "Empleados", corto: "Empleados", icono: Users },
  { href: "/configuracion/coches", texto: "Coches de sustitución", corto: "Coches", icono: Car },
  { href: "/configuracion/taller", texto: "Datos del taller", corto: "Taller", icono: Building2 },
];

export function Pestanas() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones de configuración">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1 sm:inline-grid">
        {PESTANAS.map(({ href, texto, corto, icono: I }) => {
          const activa = ruta.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activa ? "page" : undefined}
              className={cx(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors sm:px-3",
                activa ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <I className="size-4" aria-hidden /> <span className="sm:hidden">{corto}</span><span className="hidden sm:inline">{texto}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
