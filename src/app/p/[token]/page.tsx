import type { Metadata } from "next";
import { Check, Download, Phone, X } from "lucide-react";
import { caducado, cargarPresupuesto, verificarTokenPresupuesto } from "@/lib/presupuestos";
import { TEXTOS_LEGALES_BASE } from "@/lib/flujos-base";
import { fmtFecha } from "@/lib/formato";
import { Matricula } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { VistaPresupuesto } from "@/components/vista-presupuesto";
import { DecisionCliente } from "./decision";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Presupuesto", robots: { index: false, follow: false } };

/** Presupuesto para el cliente (enlace enviado por WhatsApp): lo ve, lo descarga y lo acepta o no. */
export default async function PresupuestoCliente({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await verificarTokenPresupuesto(token);
  const c = v ? await cargarPresupuesto(v.tallerId, v.id) : null;
  if (!c) return <Aviso titulo="Enlace no válido o caducado" texto="Pida al taller que le envíe el presupuesto de nuevo." />;
  const { p, ot, cliente, vehiculo, taller } = c;
  const telefono = taller.telefono;
  const pendiente = p.estado === "pendiente" && !caducado(p) && !ot.cerradaEn;

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-6" style={{ ["--primary" as string]: taller.colorPrimario }}>
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center gap-3">
          {taller.logoRuta && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logo?v=${encodeURIComponent(taller.logoRuta.slice(-12))}`} alt="" className="size-12 rounded-lg bg-white object-contain p-1" />
          )}
          <div className="min-w-0">
            <div className="font-bold">{taller.nombre}</div>
            {telefono && <a href={`tel:${telefono.replace(/\s/g, "")}`} className="text-sm text-slate-600 underline">{telefono}</a>}
          </div>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div>
            <h1 className="text-xl font-bold">Hola, {cliente.nombre.split(" ")[0]}</h1>
            <p className="text-slate-600">Este es el {p.tipo === "complementario" ? "presupuesto complementario" : "presupuesto"} de su vehículo:</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Matricula grande>{vehiculo.matricula}</Matricula>
            <span className="flex items-center gap-2 font-semibold">{vehiculo.marca && <LogoMarca marca={vehiculo.marca} className="size-7" />} {vehiculo.marca} {vehiculo.modelo}</span>
          </div>
          <VistaPresupuesto p={p} />
          <a href={`/p/${token}/pdf`} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            <Download className="size-4" aria-hidden /> Descargar en PDF
          </a>
          <p className="text-xs leading-relaxed text-slate-500">{taller.config.textoPresupuesto || TEXTOS_LEGALES_BASE.textoPresupuesto}</p>
        </section>

        {pendiente ? (
          <DecisionCliente token={token} nombre={cliente.nombre} />
        ) : p.estado === "aprobado" ? (
          <Estado icono={<Check className="size-6" />} color="bg-emerald-50 text-emerald-900 border-emerald-200" titulo="Presupuesto aceptado. ¡Gracias!" texto={`Aceptado el ${fmtFecha(p.decididoEn)}${p.decididoNombre ? ` por ${p.decididoNombre}` : ""}. Le avisaremos cuando su vehículo esté listo.`} />
        ) : p.estado === "rechazado" ? (
          <Estado icono={<X className="size-6" />} color="bg-slate-50 text-slate-800 border-slate-200" titulo="Ha indicado que no acepta este presupuesto" texto="Si cambia de opinión o quiere comentarlo, llámenos." telefono={telefono} />
        ) : (
          <Estado icono={<Phone className="size-6" />} color="bg-amber-50 text-amber-900 border-amber-200" titulo={p.estado === "sustituido" ? "Hay un presupuesto más reciente" : "Este presupuesto ya no está vigente"} texto="Pida al taller el presupuesto actualizado." telefono={telefono} />
        )}
      </div>
    </main>
  );
}

function Estado({ icono, color, titulo, texto, telefono }: { icono: React.ReactNode; color: string; titulo: string; texto: string; telefono?: string | null }) {
  return (
    <section className={`flex items-start gap-3 rounded-2xl border p-4 ${color}`} role="status">
      <span className="mt-0.5 shrink-0" aria-hidden>{icono}</span>
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="text-sm">{texto}</p>
        {telefono && <a href={`tel:${telefono.replace(/\s/g, "")}`} className="mt-2 inline-block text-sm font-semibold underline">Llamar al {telefono}</a>}
      </div>
    </section>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="mt-1 text-slate-600">{texto}</p>
      </div>
    </main>
  );
}
