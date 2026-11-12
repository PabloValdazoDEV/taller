import { requireSesion, NOMBRE_ROL } from "@/lib/auth";
import { tallerPorId } from "@/lib/taller";
import { cookies } from "next/headers";
import { Navegacion } from "@/components/navegacion";
import { BarraLateral } from "@/components/barra-lateral";
import { COOKIE_BARRA } from "@/lib/constantes";
import { salir } from "@/app/login/actions";
import Link from "next/link";
import { LogOut, Search } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSesion();
  const taller = await tallerPorId(s.tid);

  return (
    <div className="min-h-dvh md:flex" style={{ ["--primary" as string]: taller.colorPrimario }}>
      <BarraLateral taller={taller.nombre} nombre={s.nombre} rolNombre={NOMBRE_ROL[s.rol]} rol={s.rol} plegadaInicial={(await cookies()).get(COOKIE_BARRA)?.value === "1"} />

      <div className="flex-1 min-w-0 pb-20 md:pb-0">
        <header className="md:hidden sticky top-0 z-20 bg-slate-900 text-white px-4 h-14 flex items-center justify-between">
          <span className="font-bold truncate">{taller.nombre}</span>
          <div className="flex items-center gap-1">
          {s.rol !== "mecanico" && (
            <Link href="/buscar" className="p-2 rounded-lg hover:bg-white/10" aria-label="Buscar">
              <Search className="size-5" />
            </Link>
          )}
          <form action={salir} className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">{s.nombre}</span>
            <button className="p-2 rounded-lg hover:bg-white/10" aria-label="Cambiar de usuario">
              <LogOut className="size-5" />
            </button>
          </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>

      <Navegacion rol={s.rol} variante="inferior" />
    </div>
  );
}
