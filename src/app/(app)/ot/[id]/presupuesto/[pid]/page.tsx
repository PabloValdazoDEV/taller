import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSesion } from "@/lib/auth";
import { caducado, cargarPresupuesto } from "@/lib/presupuestos";
import { TEXTOS_LEGALES_BASE } from "@/lib/flujos-base";
import { Matricula, Tarjeta } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { VistaPresupuesto } from "@/components/vista-presupuesto";
import { FirmaPresupuesto } from "./firma";

export const dynamic = "force-dynamic";

/** Presupuesto en la tablet del taller para que el cliente lo revise y lo firme. */
export default async function FirmarPresupuesto({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const s = await requireSesion("importes");
  const { id, pid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(pid)) notFound();
  const c = await cargarPresupuesto(s.tid, pid);
  if (!c || c.ot.id !== id) notFound();
  const { p, ot, cliente, vehiculo, taller } = c;
  const pendiente = p.estado === "pendiente" && !caducado(p) && !ot.cerradaEn;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={`/ot/${ot.id}`} className="text-sm text-slate-500 hover:text-slate-800">← Volver a la orden {ot.numero}</Link>
        <h1 className="mt-1 text-2xl font-bold">{p.tipo === "complementario" ? "Presupuesto complementario" : "Presupuesto"}</h1>
      </div>
      <Tarjeta className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Matricula grande>{vehiculo.matricula}</Matricula>
          <span className="flex items-center gap-2 font-semibold">{vehiculo.marca && <LogoMarca marca={vehiculo.marca} className="size-7" />} {vehiculo.marca} {vehiculo.modelo}</span>
          <span className="text-slate-600">· {cliente.nombre}</span>
        </div>
        {ot.trabajoSolicitado && <p className="rounded-xl bg-slate-50 p-3 text-sm">{ot.trabajoSolicitado}</p>}
        <VistaPresupuesto p={p} />
        <p className="text-xs leading-relaxed text-slate-500">{taller.config.textoPresupuesto || TEXTOS_LEGALES_BASE.textoPresupuesto}</p>
      </Tarjeta>

      {pendiente ? (
        <FirmaPresupuesto presupuestoId={p.id} otId={ot.id} nombreCliente={cliente.nombre} />
      ) : (
        <Tarjeta className="p-4 text-center">
          <p className="font-semibold">
            {p.estado === "aprobado" ? "Este presupuesto ya está aceptado." : p.estado === "rechazado" ? "El cliente no aceptó este presupuesto." : p.estado === "sustituido" ? "Este presupuesto se ha sustituido por uno más reciente." : ot.cerradaEn ? "La orden ya está cerrada." : "Este presupuesto ha caducado: crea uno nuevo desde la orden."}
          </p>
          <Link href={`/ot/${ot.id}`} className="mt-2 inline-block text-sm font-semibold underline">Volver a la orden</Link>
        </Tarjeta>
      )}
    </div>
  );
}
