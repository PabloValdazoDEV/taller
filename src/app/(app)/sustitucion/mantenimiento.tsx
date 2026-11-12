"use client";

import { useState, useTransition } from "react";
import { Loader2, Wrench } from "lucide-react";
import { cambiarMantenimiento } from "./actions";

export function BotonMantenimiento({ cocheId, enMantenimiento }: { cocheId: string; enMantenimiento: boolean }) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pend}
        onClick={() =>
          start(async () => {
            const r = await cambiarMantenimiento(cocheId, !enMantenimiento);
            setError(r.error ?? "");
          })
        }
        className="inline-flex items-center gap-1.5 rounded-xl px-3 min-h-10 text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      >
        {pend ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
        {enMantenimiento ? "Volver a disponible" : "Pasar a mantenimiento"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
