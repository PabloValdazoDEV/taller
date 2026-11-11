import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ICONO_TIPO, NOMBRE_TIPO } from "./tipos";
import { requireSesion } from "@/lib/auth";
import { listarClientes, type FiltroTipoCliente } from "@/lib/data";
import { fmtFecha } from "@/lib/formato";
import { Matricula, Pastilla, Tarjeta, Vacio, cx } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { BuscadorClientes } from "./buscador";

export const dynamic = "force-dynamic";

const FILTROS: { v: FiltroTipoCliente; t: string }[] = [
  { v: "todos", t: "Todos" },
  { v: "particular", t: "Particulares" },
  { v: "empresa", t: "Empresas" },
  { v: "companias", t: "Aseguradoras y flotas" },
];


export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const sp = await searchParams;
  const tipo = (FILTROS.some((f) => f.v === sp.tipo) ? sp.tipo : "todos") as FiltroTipoCliente;
  const clientes = await listarClientes(s.tid, sp.q ?? "", tipo);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <div className="flex flex-wrap gap-3 items-center">
        <BuscadorClientes />
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTROS.map((f) => (
            <Link
              key={f.v}
              href={`/clientes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(f.v !== "todos" ? { tipo: f.v } : {}) })}`}
              className={cx("shrink-0 rounded-full px-3.5 py-2 text-sm font-medium border", tipo === f.v ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-700")}
            >
              {f.t}
            </Link>
          ))}
        </div>
      </div>

      <Tarjeta className="divide-y divide-slate-100">
        {clientes.length === 0 && <Vacio>No hay clientes que coincidan.</Vacio>}
        {clientes.map((c) => {
          const Icono = ICONO_TIPO[c.tipo];
          return (
            <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-3 p-3 md:p-4 hover:bg-slate-50">
              <div className="size-10 shrink-0 rounded-full bg-slate-100 grid place-items-center text-slate-500"><Icono className="size-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{c.nombre}</span>
                  {c.tipo !== "particular" && <Pastilla color="#475569">{NOMBRE_TIPO[c.tipo]}</Pastilla>}
                  {c.abiertas > 0 && <Pastilla color="#c2410c">{c.abiertas} en taller</Pastilla>}
                  {c.exentoIva && <Pastilla color="#0369a1">Exento IVA</Pastilla>}
                </div>
                <div className="text-xs text-slate-500 truncate">{[c.nif, c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
                {c.matriculas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {c.matriculas.slice(0, 4).map((m, i) => (
                      <span key={m} className="inline-flex items-center gap-1">
                        {c.marcas[i] && <LogoMarca marca={c.marcas[i]} className="size-4" />}
                        <Matricula>{m}</Matricula>
                      </span>
                    ))}
                    {c.matriculas.length > 4 && <span className="text-xs text-slate-500">+{c.matriculas.length - 4}</span>}
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-right text-xs text-slate-500 shrink-0">
                <div><b className="text-slate-800">{c.ordenes}</b> órdenes</div>
                {c.ultimaVisita && <div>Última: {fmtFecha(c.ultimaVisita)}</div>}
              </div>
              <ChevronRight className="size-4 text-slate-300 shrink-0" />
            </Link>
          );
        })}
      </Tarjeta>
      {clientes.length === 200 && <p className="text-xs text-slate-500 text-center">Mostrando los 200 primeros. Afina la búsqueda.</p>}
    </div>
  );
}
