"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Boton } from "@/components/ui";
import { SelectorTraspaso, sugerirMecanico, type Mecanico } from "@/components/traspaso";
import { cambiarEstado } from "../ot/actions";
import { BotonDeshacer } from "../ot/[id]/controles";

/**
 * Botón grande del mecánico para pasar su trabajo al siguiente paso. Pregunta quién hace la fase
 * siguiente (sugiere al especialista) y permite «Deshacer» durante unos minutos.
 */
export function AvanzarRapido({
  otId,
  siguiente,
  actual,
  etiqueta,
  mecanicos,
  yo,
}: {
  otId: string;
  siguiente: string | null;
  actual: string;
  etiqueta?: ReactNode;
  mecanicos: Mecanico[];
  yo: string;
}) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [quien, setQuien] = useState<string | null>(yo);

  const confirmar = () =>
    start(async () => {
      const previo = actual;
      const r = await cambiarEstado(otId, null, undefined, quien);
      setError(r.error ?? "");
      if (!r.error) {
        setHecho(previo);
        setEligiendo(false);
      }
    });

  return (
    <div>
      {siguiente && eligiendo ? (
        <div className="rounded-xl border border-slate-300 bg-white p-3 space-y-3">
          <SelectorTraspaso mecanicos={mecanicos} valor={quien} onChange={setQuien} actualId={yo} fase={siguiente} />
          <div className="flex gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setEligiendo(false)} disabled={pend}>Cancelar</Boton>
            <Boton type="button" className="flex-1 min-h-12" onClick={confirmar} disabled={pend}>
              {pend ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />} Pasar a «{siguiente}»
            </Boton>
          </div>
        </div>
      ) : siguiente ? (
        <Boton
          className="w-full min-h-12"
          disabled={pend}
          onClick={() => {
            setQuien(sugerirMecanico(mecanicos, siguiente, yo));
            setEligiendo(true);
          }}
        >
          <ChevronRight className="size-4" /> Terminado → {siguiente}
        </Boton>
      ) : (
        <div className="text-sm text-slate-500 min-h-12 flex items-center px-2">{etiqueta}</div>
      )}
      {hecho && <BotonDeshacer otId={otId} anterior={hecho} onHecho={() => setHecho(null)} />}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
