"use client";

import { useState, useTransition } from "react";
import { Check, Printer } from "lucide-react";
import { cambiarEstado, fijarPeritaje } from "../ot/actions";
import { Boton, Input, cx } from "@/components/ui";

/** Día de peritaje y perito, editables en la propia lista (se guarda al pulsar «Guardar»). */
export function FechaPerito({ otId, fecha, perito }: { otId: string; fecha: string | null; perito: string | null }) {
  const [f, setF] = useState(fecha ?? "");
  const [p, setP] = useState(perito ?? "");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(false);
  const [pendiente, start] = useTransition();
  const cambiado = f !== (fecha ?? "") || p !== (perito ?? "");
  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-36">
          <span className="block text-xs text-slate-500">Día de peritaje</span>
          <Input type="date" value={f} onChange={(e) => (setF(e.target.value), setHecho(false))} className="min-h-10 text-sm" />
        </label>
        <label className="min-w-0 flex-1 basis-36">
          <span className="block text-xs text-slate-500">Perito</span>
          <Input value={p} onChange={(e) => (setP(e.target.value), setHecho(false))} placeholder="Nombre del perito" className="min-h-10 text-sm" maxLength={80} />
        </label>
        {(cambiado || hecho) && (
          <Boton
            type="button"
            variante="secundario"
            className="min-h-10 text-sm"
            disabled={pendiente || !cambiado}
            onClick={() =>
              start(async () => {
                const r = await fijarPeritaje(otId, f, p);
                setError(r.error ?? "");
                if (!r.error) setHecho(true);
              })
            }
          >
            {hecho && !cambiado ? <><Check className="size-4 text-emerald-600" aria-hidden /> Guardado</> : pendiente ? "Guardando…" : "Guardar"}
          </Boton>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

/** «Peritado» / «Autorizado»: mueve la orden al estado indicado, con nota (obligatoria al salir de una aprobación). */
export function AvanzarPeritaje({
  otId,
  destinoId,
  etiqueta,
  ayuda,
  notaObligatoria = false,
}: {
  otId: string;
  destinoId: string;
  etiqueta: string;
  ayuda: string;
  notaObligatoria?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();
  if (!abierto)
    return (
      <Boton type="button" className="min-h-10 text-sm print:hidden" onClick={() => setAbierto(true)}>
        <Check className="size-4" aria-hidden /> {etiqueta}
      </Boton>
    );
  return (
    <div className="w-full space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 print:hidden">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700">{ayuda}{!notaObligatoria && " (opcional)"}</span>
        <Input value={nota} onChange={(e) => setNota(e.target.value)} autoFocus className="mt-1 text-sm" maxLength={300} />
      </label>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Boton
          type="button"
          className="min-h-10 text-sm"
          disabled={pendiente || (notaObligatoria && nota.trim().length < 3)}
          onClick={() =>
            start(async () => {
              const r = await cambiarEstado(otId, destinoId, nota);
              if (r.error) setError(r.error);
              else setAbierto(false);
            })
          }
        >
          {pendiente ? "Guardando…" : `Confirmar: ${etiqueta.toLowerCase()}`}
        </Boton>
        <Boton type="button" variante="secundario" className="min-h-10 text-sm" onClick={() => (setAbierto(false), setError(""))}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}

export function Imprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cx("inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 print:hidden")}
    >
      <Printer className="size-4" aria-hidden /> Imprimir lista
    </button>
  );
}
