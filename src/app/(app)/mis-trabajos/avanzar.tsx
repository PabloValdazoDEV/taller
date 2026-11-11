"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Boton } from "@/components/ui";
import { cambiarEstado } from "../ot/actions";

export function AvanzarRapido({ otId, siguiente }: { otId: string; siguiente: string }) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <Boton
        className="w-full min-h-12"
        disabled={pend}
        onClick={() => start(async () => {
          const r = await cambiarEstado(otId, null);
          setError(r.error ?? "");
        })}
      >
        {pend ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />} Terminado → {siguiente}
      </Boton>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
