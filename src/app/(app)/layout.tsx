import { cookies } from "next/headers";
import { LogOut, Search } from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { tallerPorId } from "@/lib/taller";
import { nombresPuestos, tiene } from "@/lib/puestos";
import { Navegacion } from "@/components/navegacion";
import { BarraLateral } from "@/components/barra-lateral";
import { COOKIE_BARRA } from "@/lib/constantes";
import { salir } from "@/app/login/actions";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSesion();
  const taller = await tallerPorId(s.tid);
  const logo = taller.logoRuta ? `/api/logo?v=${encodeURIComponent(taller.logoRuta.slice(-12))}` : null;

  return (
    <div className="min-h-dvh md:flex" style={{ ["--primary" as string]: taller.colorPrimario }}>
      <BarraLateral
        taller={taller.nombre}
        logo={logo}
        nombre={s.nombre}
        puestosNombre={nombresPuestos(s.puestos)}
        puestos={s.puestos}
        plegadaInicial={(await cookies()).get(COOKIE_BARRA)?.value === "1"}
      />

      <div className="flex-1 min-w-0 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">
        <header className="md:hidden print:hidden sticky top-0 z-20 bg-slate-900 text-white px-4 h-14 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-8 rounded-md bg-white object-contain p-0.5" />
            )}
            <span className="font-bold truncate">{taller.nombre}</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
          {tiene(s.puestos, "oficina") && (
            <Link href="/buscar" className="grid place-items-center size-11 rounded-lg hover:bg-white/10" aria-label="Buscar">
              <Search className="size-5" aria-hidden />
            </Link>
          )}
          <form action={salir} className="flex items-center gap-1 text-sm">
            <span className="text-slate-300 truncate max-w-24">{s.nombre}</span>
            <button className="grid place-items-center size-11 rounded-lg hover:bg-white/10" aria-label="Cambiar de usuario">
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>

      <Navegacion puestos={s.puestos} variante="inferior" />
    </div>
  );
}
