"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Boton, Campo, Input } from "@/components/ui";
import { PanelFirma } from "@/components/firma";
import { aceptarPorEnlace, rechazarPorEnlace } from "../actions";

/** Aceptar (nombre + firma) o no aceptar el presupuesto desde el móvil del cliente. */
export function DecisionCliente({ token, nombre }: { token: string; nombre: string }) {
  const [firmante, setFirmante] = useState(nombre);
  const [firma, setFirma] = useState<string | null>(null);
  const [conforme, setConforme] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  const ejecutar = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6" aria-labelledby="h-decision">
      <h2 id="h-decision" className="text-lg font-semibold">¿Acepta el presupuesto?</h2>
      {rechazando ? (
        <>
          <Campo etiqueta="Si quiere, díganos el motivo (opcional)"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Prefiero pensarlo" /></Campo>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setRechazando(false)}>Volver</Boton>
            <Boton type="button" variante="secundario" disabled={pend} onClick={() => ejecutar(() => rechazarPorEnlace(token, firmante, motivo))}>
              {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} No acepto el presupuesto
            </Boton>
          </div>
        </>
      ) : (
        <>
          <Campo etiqueta="Su nombre"><Input value={firmante} onChange={(e) => setFirmante(e.target.value)} autoComplete="name" /></Campo>
          <PanelFirma onChange={setFirma} etiqueta="Su firma" />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={conforme} onChange={(e) => setConforme(e.target.checked)} />
            <span>He leído el presupuesto y autorizo la reparación por el importe indicado.</span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setRechazando(true)} disabled={pend}>No lo acepto</Boton>
            <Boton
              type="button"
              variante="exito"
              className="min-h-12 px-6 text-base"
              disabled={pend || !firma || !conforme || firmante.trim().length < 2}
              onClick={() => firma && ejecutar(() => aceptarPorEnlace(token, firmante, firma))}
            >
              {pend ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />} Acepto el presupuesto
            </Boton>
          </div>
        </>
      )}
    </section>
  );
}
