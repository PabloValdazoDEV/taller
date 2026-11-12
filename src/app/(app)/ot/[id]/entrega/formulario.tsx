"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Boton, Campo, Input, Tarjeta, Textarea } from "@/components/ui";
import { PanelFirma } from "@/components/firma";
import { FotosInput } from "@/components/fotos-input";
import { KmInput } from "@/components/km-input";
import { fmtKm } from "@/lib/formato";
import { registrarEntrega } from "./actions";

export function FormularioEntrega(p: { otId: string; kmEntrada: number | null; trabajoSugerido: string; garantia: string; firmante: string; bloqueo: string | null; sinReparar?: boolean }) {
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  return (
    <form
      className="space-y-5"
      action={(fd) => {
        if (!firma) return setError("Falta la firma del cliente");
        fd.set("firma", firma);
        start(async () => {
          const r = await registrarEntrega(fd);
          if (r?.error) setError(r.error);
        });
      }}
    >
      <input type="hidden" name="otId" value={p.otId} />
      {p.sinReparar && <input type="hidden" name="sinReparar" value="1" />}
      <Tarjeta className="p-4 md:p-6 space-y-4">
        {p.sinReparar && (
          <Campo etiqueta="Motivo por el que se lo lleva sin reparar">
            <Textarea name="motivoSinReparar" rows={2} required placeholder="Ej.: No acepta el presupuesto · Lo repara en otro taller · Siniestro rehusado por la compañía" />
          </Campo>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Kilómetros a la salida" ayuda={p.kmEntrada != null ? `Entrada: ${fmtKm(p.kmEntrada)}` : undefined}>
            <KmInput name="km" defaultValue={p.kmEntrada} />
          </Campo>
        </div>
        <Campo etiqueta={p.sinReparar ? "Trabajos realizados (si se hizo alguno, p. ej. diagnóstico)" : "Trabajos realizados"}>
          <Textarea name="trabajos" rows={p.sinReparar ? 2 : 4} defaultValue={p.trabajoSugerido} required={!p.sinReparar} placeholder={p.sinReparar ? "Vacío = ninguna reparación" : undefined} />
        </Campo>
        <Campo etiqueta="Piezas sustituidas" ayuda="Las piezas sustituidas quedan a disposición del cliente.">
          <Textarea name="piezas" rows={2} placeholder="Ej.: Pastillas de freno delanteras, filtro de aceite…" />
        </Campo>
        {!p.sinReparar && <Campo etiqueta="Garantía"><Input name="garantia" defaultValue={p.garantia} /></Campo>}
      </Tarjeta>

      <Tarjeta className="p-4 md:p-6 space-y-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">Fotos del vehículo terminado (después)</div>
          <p className="text-sm text-slate-500">Opcional. Recomendado en chapa y pintura y siniestros: se comparan con las de la recepción y se incluyen en el acta.</p>
        </div>
        <FotosInput name="fotos" texto="Foto" />
      </Tarjeta>

      <Tarjeta className="p-4 md:p-6 space-y-4">
        <p className="text-sm text-slate-600">Entregue la tablet al cliente para que firme la recepción conforme del vehículo.</p>
        <Campo etiqueta="Nombre de quien recoge"><Input name="firmante" defaultValue={p.firmante} required /></Campo>
        <PanelFirma onChange={setFirma} etiqueta="Firma de conformidad" />
      </Tarjeta>

      {(error || p.bloqueo) && <p className="rounded-xl bg-red-50 text-red-700 text-sm p-3" role="alert">{error || p.bloqueo}</p>}
      <div className="flex justify-end">
        <Boton type="submit" variante="exito" className="min-h-12 px-6 text-base" disabled={pend || !firma || !!p.bloqueo}>
          {pend ? <><Loader2 className="size-5 animate-spin" /> Generando acta…</> : <><Check className="size-5" /> {p.sinReparar ? "Firmar retirada sin reparar" : "Firmar y entregar"}</>}
        </Boton>
      </div>
    </form>
  );
}
