import Link from "next/link";
import { requireSesion } from "@/lib/auth";
import { flotaSustitucion } from "@/lib/data";
import { fmtCombustible, fmtFecha, fmtFechaHora, fmtKm } from "@/lib/formato";
import { BotonLink, Matricula, Pastilla, Tarjeta } from "@/components/ui";
import { VistasDanos } from "@/components/silueta-danos";

export const dynamic = "force-dynamic";

const ESTADO = { disponible: ["Disponible", "#059669"], prestado: ["Prestado", "#d97706"], mantenimiento: ["Mantenimiento", "#64748b"] } as const;

export default async function Flota() {
  const s = await requireSesion("sustitucion");
  const flota = await flotaSustitucion(s.tid);
  const en30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Coches de sustitución</h1>
      <p className="text-sm text-slate-600">Para prestar un coche, ábrelo desde la orden del cliente (botón «Coche sustitución»).</p>
      <div className="grid items-start md:grid-cols-2 gap-4">
        {flota.map((c) => {
          const [txt, color] = ESTADO[c.estado];
          return (
            <Tarjeta key={c.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3"><Matricula grande>{c.matricula}</Matricula><span className="font-semibold">{c.marca} {c.modelo}</span></div>
                <Pastilla color={color}>{txt}</Pastilla>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Km</span> <b>{fmtKm(c.km)}</b></div>
                <div><span className="text-slate-500">Combustible</span> <b>{fmtCombustible(c.combustible)}</b></div>
                <div className={c.itvHasta && c.itvHasta < en30 ? "text-red-600 font-semibold" : ""}><span className="text-slate-500">ITV</span> {fmtFecha(c.itvHasta)}</div>
                <div className={c.seguroHasta && c.seguroHasta < en30 ? "text-red-600 font-semibold" : ""}><span className="text-slate-500">Seguro</span> {fmtFecha(c.seguroHasta)}</div>
              </div>
              {c.danos.length > 0 && (
                <details className="rounded-xl border border-slate-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">{c.danos.length} daño(s) registrados</summary>
                  <div className="border-t border-slate-100 p-3"><VistasDanos danos={c.danos} conLista /></div>
                </details>
              )}
              {c.prestamo && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <div className="font-semibold">{c.prestamo.p.conductorNombre}</div>
                    <div className="text-xs text-slate-600">
                      Desde {fmtFechaHora(c.prestamo.p.salidaEn)}
                      {c.prestamo.otId && <> · <Link className="underline" href={`/ot/${c.prestamo.otId}`}>Orden {c.prestamo.otNumero}</Link></>}
                    </div>
                  </div>
                  <BotonLink variante="secundario" className="min-h-9" href={`/sustitucion/${c.prestamo.p.id}/devolucion`}>Devolución</BotonLink>
                </div>
              )}
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
