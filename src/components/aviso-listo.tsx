"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { marcarAvisadoListo } from "@/app/(app)/ot/actions";
import { telefonoInternacional } from "@/lib/telefono";
import { cx } from "./ui";

/**
 * Avisar al cliente de que su coche está listo, respetando cómo quiere que le avisen
 * (WhatsApp y/o llamada). Al usarlo queda apuntado y se muestra «Avisado hace…».
 */
export function AvisoListo({
  otId,
  enlaceWa,
  telefono,
  aceptaWhatsapp,
  aceptaLlamada,
  avisadoEn,
}: {
  otId: string;
  enlaceWa: string | null;
  telefono: string | null;
  aceptaWhatsapp: boolean;
  aceptaLlamada: boolean;
  avisadoEn: Date | null;
}) {
  const [avisado, setAvisado] = useState(avisadoEn);
  const [, start] = useTransition();
  const marcar = (canal: "whatsapp" | "llamada") => {
    setAvisado(new Date());
    start(async () => void (await marcarAvisadoListo(otId, canal)));
  };
  const tel = telefonoInternacional(telefono);
  const btn = "inline-flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-semibold";
  const yaAvisado = !!avisado;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {aceptaWhatsapp && enlaceWa && (
        <a href={enlaceWa} target="_blank" rel="noopener" onClick={() => marcar("whatsapp")} className={cx(btn, yaAvisado ? "bg-white border border-[#25D366] text-[#128C7E]" : "bg-[#25D366] text-white")}>
          <MessageCircle className="size-4" /> {yaAvisado ? "Reenviar" : "Avisar"}
        </a>
      )}
      {aceptaLlamada && tel && (
        <a href={`tel:+${tel}`} onClick={() => marcar("llamada")} className={cx(btn, "bg-white border border-slate-300 text-slate-700")}>
          <Phone className="size-4" /> Llamar
        </a>
      )}
      {!aceptaWhatsapp && !aceptaLlamada && <span className="text-xs text-slate-500">No desea avisos</span>}
      {avisado && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <Check className="size-3.5" /> Avisado {haceCuanto(avisado)}
        </span>
      )}
    </div>
  );
}

function haceCuanto(d: Date) {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}
