"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Boton, Campo, Input, Tarjeta } from "@/components/ui";
import { PanelFirma } from "@/components/firma";
import { aceptarEnTablet, rechazarPresupuesto } from "../../../presupuestos-actions";

/** Firma del cliente en la tablet: acepta (PDF firmado) o no acepta. */
export function FirmaPresupuesto({ presupuestoId, otId, nombreCliente }: { presupuestoId: string; otId: string; nombreCliente: string }) {
  const router = useRouter();
  const [firmante, setFirmante] = useState(nombreCliente);
  const [firma, setFirma] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  function aceptar() {
    if (!firma) return setError("Falta la firma del cliente");
    const fd = new FormData();
    fd.set("presupuestoId", presupuestoId);
    fd.set("firmante", firmante);
    fd.set("firma", firma);
    start(async () => {
      setError("");
      const r = await aceptarEnTablet(fd);
      if (r?.error) setError(r.error);
    });
  }

  function rechazar() {
    start(async () => {
      setError("");
      const r = await rechazarPresupuesto(presupuestoId, motivo);
      if (r.error) setError(r.error);
      else router.push(`/ot/${otId}`);
    });
  }

  return (
    <Tarjeta className="space-y-4 p-4 md:p-6">
      <p className="text-sm text-slate-600">Entregue la tablet al cliente. Al firmar acepta el presupuesto y autoriza la reparación por el importe indicado.</p>
      <Campo etiqueta="Nombre de quien firma"><Input value={firmante} onChange={(e) => setFirmante(e.target.value)} /></Campo>
      <PanelFirma onChange={setFirma} />
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {rechazando ? (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <Campo etiqueta="Motivo (opcional)"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Prefiere pensarlo / Le parece caro" /></Campo>
          <div className="flex flex-wrap justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setRechazando(false)}>Volver</Boton>
            <Boton type="button" variante="secundario" onClick={rechazar} disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Confirmar que no acepta</Boton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2">
          <Boton type="button" variante="secundario" onClick={() => setRechazando(true)} disabled={pend}><X className="size-4" aria-hidden /> No acepta</Boton>
          <Boton type="button" variante="exito" onClick={aceptar} disabled={pend || !firma || firmante.trim().length < 2} className="px-6 text-base min-h-12">
            {pend ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />} Aceptar y firmar
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}
