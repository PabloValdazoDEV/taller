import { tiene } from "@/lib/puestos";
import { requireSesion } from "@/lib/auth";
import { listarOTsAbiertas, tiposConEstados, type OTResumen } from "@/lib/data";
import { OtTarjeta } from "@/components/ot-tarjeta";
import { AutoRefresco } from "@/components/auto-refresco";
import { BotonLink, Pastilla, Tarjeta, Vacio } from "@/components/ui";
import { AvanzarRapido } from "./avanzar";

export const dynamic = "force-dynamic";

export default async function MisTrabajos() {
  const s = await requireSesion("misTrabajos");
  const [mias, todas, tipos] = await Promise.all([listarOTsAbiertas(s.tid, { mecanicoId: s.uid }), tiene(s.puestos, "gestionTaller") ? listarOTsAbiertas(s.tid) : Promise.resolve([]), tiposConEstados(s.tid)]);
  const sinAsignar = todas.filter((o) => !o.mecanicoId);

  const siguienteDe = (o: OTResumen) => {
    const est = tipos.find((tp) => tp.id === o.tipoId)?.estados ?? [];
    const sig = est.find((e) => e.orden > o.estadoOrden);
    return sig && sig.marca !== "final" ? sig.nombre : null;
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <AutoRefresco segundos={20} />
      <div>
        <h1 className="text-2xl font-bold">Mis trabajos</h1>
        <p className="text-sm text-slate-500">{mias.length} vehículo(s) asignados a ti</p>
      </div>
      {mias.length === 0 && <Tarjeta><Vacio>No tienes trabajos asignados ahora mismo.</Vacio></Tarjeta>}
      {mias.map((o) => {
        const sig = siguienteDe(o);
        const bloqueado = o.requiereAprobacion;
        return (
          <div key={o.id} className="space-y-2">
            <OtTarjeta ot={o} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {sig && !bloqueado && o.estadoMarca !== "listo" ? (
                <AvanzarRapido otId={o.id} siguiente={sig} />
              ) : (
                <div className="text-sm text-slate-500 self-center px-2">
                  {bloqueado ? <Pastilla color="#7c3aed">Esperando aprobación</Pastilla> : o.estadoMarca === "listo" ? <Pastilla color="#059669">Listo</Pastilla> : null}
                </div>
              )}
              <BotonLink variante="secundario" className="min-h-12" href={`/ot/${o.id}`}>Incidencia / fotos</BotonLink>
            </div>
          </div>
        );
      })}
      {sinAsignar.length > 0 && (
        <div className="pt-4">
          <h2 className="font-semibold mb-2">Sin asignar ({sinAsignar.length})</h2>
          <div className="space-y-2">{sinAsignar.map((o) => <OtTarjeta key={o.id} ot={o} />)}</div>
        </div>
      )}
    </div>
  );
}
