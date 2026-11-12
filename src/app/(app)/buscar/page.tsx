import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Search, Users, Wrench } from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { buscarOTs, listarClientes } from "@/lib/data";
import { fmtFecha } from "@/lib/formato";
import { OtTarjeta } from "@/components/ot-tarjeta";
import { Matricula, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";

export const dynamic = "force-dynamic";

/**
 * Búsqueda global (matrícula, nº de orden, cliente, teléfono, nº de siniestro).
 * Sin texto muestra las últimas órdenes entregadas (histórico).
 * Si la búsqueda da exactamente un coche en taller, va directo a su orden.
 */
export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string; todo?: string }> }) {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const { q = "", todo } = await searchParams;
  const texto = q.trim();

  const [abiertas, cerradas, clientes] = await Promise.all([
    texto ? buscarOTs(s.tid, texto, { cerradas: false, limite: 30 }) : Promise.resolve([]),
    buscarOTs(s.tid, texto, { cerradas: true, limite: texto ? 30 : 40 }),
    texto ? listarClientes(s.tid, texto) : Promise.resolve([]),
  ]);
  if (texto && !todo && abiertas.length === 1 && cerradas.length === 0 && clientes.length <= 1) redirect(`/ot/${abiertas[0].id}`);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">{texto ? "Resultados" : "Buscar e histórico"}</h1>
        <form action="/buscar" className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={texto}
              autoFocus={!texto}
              placeholder="Matrícula, nº de orden, cliente, teléfono o nº de siniestro"
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-base"
            />
          </div>
          <button className="rounded-xl bg-primary text-white font-semibold px-5 min-h-12">Buscar</button>
        </form>
      </div>

      {texto && (
        <section>
          <TituloSeccion><span className="inline-flex items-center gap-2"><Wrench className="size-4" /> En taller ({abiertas.length})</span></TituloSeccion>
          {abiertas.length === 0 ? (
            <Tarjeta><Vacio>Ningún vehículo en taller con «{texto}».</Vacio></Tarjeta>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{abiertas.map((o) => <OtTarjeta key={o.id} ot={o} />)}</div>
          )}
        </section>
      )}

      {texto && clientes.length > 0 && (
        <section>
          <TituloSeccion><span className="inline-flex items-center gap-2"><Users className="size-4" /> Clientes ({clientes.length})</span></TituloSeccion>
          <Tarjeta className="divide-y divide-slate-100">
            {clientes.slice(0, 10).map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`} className="flex flex-wrap items-center gap-3 p-3 min-h-14 hover:bg-slate-50">
                <span className="font-semibold flex-1 min-w-40">{c.nombre}</span>
                {c.matriculas.slice(0, 3).map((m) => <Matricula key={m}>{m}</Matricula>)}
                <span className="text-xs text-slate-500">{c.telefono}</span>
              </Link>
            ))}
          </Tarjeta>
        </section>
      )}

      <section>
        <TituloSeccion><span className="inline-flex items-center gap-2"><History className="size-4" /> {texto ? `Entregadas (${cerradas.length})` : "Últimas entregadas"}</span></TituloSeccion>
        {cerradas.length === 0 ? (
          <Tarjeta><Vacio>{texto ? "Ninguna orden entregada coincide." : "Todavía no se ha entregado ningún vehículo."}</Vacio></Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-slate-100">
            {cerradas.map((o) => (
              <Link key={o.id} href={`/ot/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 min-h-14 hover:bg-slate-50">
                <Matricula>{o.matricula}</Matricula>
                <span className="flex items-center gap-1.5 font-medium min-w-40 flex-1">
                  {o.marca && <LogoMarca marca={o.marca} className="size-5" />} {o.marca} {o.modelo}
                  <span className="text-slate-500 font-normal">· {o.clienteNombre}</span>
                </span>
                <span className="text-xs rounded-full px-2 py-0.5 text-white" style={{ background: o.tipoColor }}>{o.tipoNombre}</span>
                <span className={`text-xs tabular-nums w-40 text-right ${o.anuladaEn ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                  {o.numero} · {o.anuladaEn ? "anulada" : "entregado"} {fmtFecha(o.cerradaEn)}
                </span>
              </Link>
            ))}
          </Tarjeta>
        )}
      </section>
    </div>
  );
}
