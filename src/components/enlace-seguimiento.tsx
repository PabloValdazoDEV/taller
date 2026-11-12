"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

/** Botones para mandar al cliente su enlace de seguimiento (ficha de la orden, oficina). */
export function EnlaceSeguimiento({ enlace, whatsapp }: { enlace: string; whatsapp: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const btn = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition";
  return (
    <div className="flex flex-wrap gap-2">
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener" className={`${btn} bg-[#25D366] text-white hover:brightness-105`}>
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </a>
      )}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(enlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            window.prompt("Copia el enlace:", enlace);
          }
        }}
        className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
      >
        {copiado ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copiado ? "Copiado" : "Copiar enlace"}
      </button>
      <a href={enlace} target="_blank" rel="noopener" className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
        <ExternalLink className="size-4" aria-hidden /> Ver como el cliente
      </a>
    </div>
  );
}
