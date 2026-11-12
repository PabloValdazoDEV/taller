import Link from "next/link";
import { History, MessageCircle, Phone, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { buscarGlobal, buscarOTs } from "@/lib/data";
import { FASE_CLIENTE, faseCliente, hoyISO, queDecirle } from "@/lib/estado-cliente";
import { enlaceWhatsapp, fmtFecha } from "@/lib/formato";
import { BuscadorGlobal } from "@/components/buscador-global";
import { Matricula, Pastilla, Tarjeta, Vacio } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";

export const dynamic = "force-dynamic";

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireSesion("oficina");
  const q = ((await searchParams).q ?? "").trim();
  // Sin texto: histórico de las últimas entregadas; con texto: lo que coincide (incluidas las anuladas)
  const [{ ordenes, clientes }, cerradas] = await Promise.all([
    buscarGlobal(s.tid, q),
    q.length === 1 ? Promise.resolve([]) : buscarOTs(s.tid, q, { cerradas: true, limite: q ? 30 : 40 }),
  ]);
  const hoy = hoyISO();
  const abiertas = ordenes.filter((o) => !o.cerradaEn);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Buscar</h1>
        <BuscadorGlobal valor={q} grande autoFocus enVivo />
        {!q && <p className="text-sm text-slate-500">Pensado para cuando llama un cliente: escribe la matrícula, su teléfono o su nombre y verás al momento cómo va su coche y qué contarle.</p>}
        {q.length === 1 && <p className="text-sm text-slate-500">Escribe al menos 2 caracteres.</p>}
      </div>

      {q.length >= 2 && abiertas.length === 0 && clientes.length === 0 && cerradas.length === 0 && (
        <Tarjeta><Vacio>No hay nada que coincida con «{q}».</Vacio></Tarjeta>
      )}

      {abiertas.length > 0 && (
        <section aria-labelledby="h-taller" className="space-y-3">
          <h2 id="h-taller" className="font-semibold text-slate-800">En el taller ahora ({abiertas.length})</h2>
          {abiertas.map((o) => {
            const fase = FASE_CLIENTE[faseCliente(o)];
            const nombre = o.clienteNombre.split(" ")[0];
            const wa = enlaceWhatsapp(o.clienteTelefono, `Hola ${nombre}, le escribimos del taller sobre su ${o.marca ?? "vehículo"} ${o.matricula}. `);
            return (
              <Tarjeta key={o.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
                  {o.marca && <LogoMarca marca={o.marca} className="size-9" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Matricula>{o.matricula}</Matricula>
                      <span className="font-semibold">{o.marca} {o.modelo}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" aria-hidden /> {o.clienteNombre}</span>
                      {o.clienteTelefono && <span className="tabular-nums">{o.clienteTelefono}</span>}
                      {o.datosSiniestro?.companiaNombre && <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" aria-hidden /> {o.datosSiniestro.companiaNombre}</span>}
                    </div>
                  </div>
                  <Pastilla color={fase.color} className="text-sm">{fase.titulo}</Pastilla>
                </div>
                <div className="space-y-3 p-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qué decirle</div>
                    <p className="mt-1 text-base text-slate-900">{queDecirle(o, hoy)}</p>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex gap-2"><dt className="text-slate-500">Estado interno</dt><dd className="font-medium">{o.estadoNombre}</dd></div>
                    <div className="flex gap-2"><dt className="text-slate-500">Entró</dt><dd className="font-medium">{fmtFecha(o.fechaEntrada)}</dd></div>
                    <div className="flex gap-2"><dt className="text-slate-500">Prevista</dt><dd className={o.fechaPrevista && o.fechaPrevista < hoy ? "font-semibold text-red-700" : "font-medium"}>{fmtFecha(o.fechaPrevista)}</dd></div>
                    <div className="flex gap-2"><dt className="text-slate-500">Mecánico</dt><dd className="inline-flex items-center gap-1 font-medium"><Wrench className="size-3.5" aria-hidden /> {o.mecanicoNombre ?? "Sin asignar"}</dd></div>
                    <div className="flex gap-2 sm:col-span-2"><dt className="shrink-0 text-slate-500">Trabajo</dt><dd>{o.trabajo}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/ot/${o.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                      Abrir orden {o.numero}
                    </Link>
                    {o.clienteTelefono && (
                      <a href={`tel:${o.clienteTelefono.replace(/\s/g, "")}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                        <Phone className="size-4" aria-hidden /> Llamar
                      </a>
                    )}
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                        <MessageCircle className="size-4 text-[#128C7E]" aria-hidden /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </Tarjeta>
            );
          })}
        </section>
      )}

      {clientes.length > 0 && (
        <section aria-labelledby="h-clientes" className="space-y-3">
          <h2 id="h-clientes" className="font-semibold text-slate-800">Clientes ({clientes.length})</h2>
          <Tarjeta className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.nombre}</div>
                  <div className="text-sm text-slate-500">{[c.telefono, c.nif].filter(Boolean).join(" · ") || "Sin teléfono"}</div>
                </div>
                <div className="flex flex-wrap gap-1">{c.matriculas.slice(0, 3).map((m) => <Matricula key={m}>{m}</Matricula>)}</div>
                {c.abiertas > 0 && <Pastilla color="#0369a1">{c.abiertas} en taller</Pastilla>}
              </Link>
            ))}
          </Tarjeta>
        </section>
      )}

      {cerradas.length > 0 && (
        <section aria-labelledby="h-historial" className="space-y-3">
          <h2 id="h-historial" className="inline-flex items-center gap-2 font-semibold text-slate-800">
            <History className="size-4" aria-hidden /> {q ? `Historial (${cerradas.length})` : "Últimas entregadas"}
          </h2>
          <Tarjeta className="divide-y divide-slate-100">
            {cerradas.map((o) => (
              <Link key={o.id} href={`/ot/${o.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50">
                <Matricula>{o.matricula}</Matricula>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center gap-1.5 font-medium">
                    {o.marca && <LogoMarca marca={o.marca} className="size-5" />} {o.marca} {o.modelo}
                    <span className="font-normal text-slate-500">· {o.clienteNombre}</span>
                  </div>
                  <div className="font-mono text-xs text-slate-500">{o.numero}</div>
                </div>
                <Pastilla color={o.tipoColor}>{o.tipoNombre}</Pastilla>
                <span className={o.anuladaEn ? "text-sm font-semibold text-red-700" : "text-sm text-slate-500"}>
                  {o.anuladaEn ? "Anulada" : "Entregado"} {fmtFecha(o.cerradaEn)}
                </span>
              </Link>
            ))}
          </Tarjeta>
        </section>
      )}
    </div>
  );
}
