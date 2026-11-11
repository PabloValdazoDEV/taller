"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageCircle, Share2 } from "lucide-react";
import { enlaceWhatsapp } from "@/lib/formato";
import { cx } from "./ui";

/**
 * Envío de un documento firmado al cliente:
 *  - «Compartir PDF»: menú nativo del sistema (Web Share API) → WhatsApp con el PDF adjunto. Solo en
 *    dispositivos que lo permiten (tablets/móviles, Safari en Mac) y con HTTPS o localhost.
 *  - «WhatsApp con enlace»: abre WhatsApp con un mensaje que incluye el enlace de descarga seguro.
 */
export function CompartirDocumento({
  docId,
  enlace,
  telefono,
  mensaje,
  nombreFichero,
  compacto = false,
}: {
  docId: string;
  enlace: string;
  telefono: string | null;
  mensaje: string;
  nombreFichero: string;
  compacto?: boolean;
}) {
  const fichero = useRef<File | null>(null);
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState("");

  // El PDF se descarga por adelantado: Safari exige llamar a share() inmediatamente tras el toque.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return;
        const r = await fetch(`/api/documentos/${docId}`);
        if (!r.ok) return;
        const f = new File([await r.blob()], nombreFichero, { type: "application/pdf" });
        if (vivo && navigator.canShare({ files: [f] })) {
          fichero.current = f;
          setPuedeCompartir(true);
        }
      } catch {
        /* sin soporte: queda el enlace */
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [docId, nombreFichero]);

  async function compartir() {
    if (!fichero.current) return;
    try {
      await navigator.share({ files: [fichero.current], title: nombreFichero, text: mensaje });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAviso("No se pudo compartir. Usa el enlace por WhatsApp.");
    }
  }

  const textoConEnlace = `${mensaje}\n\n${enlace}\n(Enlace personal, válido 30 días)`;
  const wa = enlaceWhatsapp(telefono, textoConEnlace);
  const btn = cx(
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition",
    compacto ? "px-2.5 min-h-9 text-xs" : "px-4 min-h-11 text-sm",
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cargando ? (
        <span className={cx(btn, "bg-slate-100 text-slate-400")}><Loader2 className="size-4 animate-spin" /> PDF</span>
      ) : (
        puedeCompartir && (
          <button type="button" onClick={compartir} className={cx(btn, "bg-slate-900 text-white hover:bg-slate-800")}>
            <Share2 className="size-4" /> Compartir PDF
          </button>
        )
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener" className={cx(btn, "bg-[#25D366] text-white hover:brightness-105")}>
          <MessageCircle className="size-4" /> WhatsApp{!compacto && " con enlace"}
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
            setAviso(enlace);
          }
        }}
        className={cx(btn, "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50")}
        title="Copiar enlace de descarga"
      >
        {copiado ? <Check className="size-4 text-emerald-600" /> : compacto ? <Link2 className="size-4" /> : <Copy className="size-4" />}
        {!compacto && (copiado ? "Copiado" : "Copiar enlace")}
      </button>
      {aviso && <p className="w-full text-xs text-slate-500 break-all">{aviso}</p>}
    </div>
  );
}
