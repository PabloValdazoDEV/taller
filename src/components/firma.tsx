"use client";

import { useEffect, useRef } from "react";
import SignaturePad from "signature_pad";
import { Eraser } from "lucide-react";

/** Panel de firma manuscrita. Devuelve un PNG (data URL) o null si está vacío. */
export function PanelFirma({ onChange, etiqueta = "Firma del cliente" }: { onChange: (png: string | null) => void; etiqueta?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const pad = new SignaturePad(canvas, { penColor: "#0f172a", minWidth: 1, maxWidth: 2.8, backgroundColor: "rgba(255,255,255,0)" });
    padRef.current = pad;
    pad.addEventListener("endStroke", () => cbRef.current(pad.isEmpty() ? null : pad.toDataURL("image/png")));

    const ajustar = () => {
      const datos = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(datos);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      pad.off();
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{etiqueta}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 px-2 py-1"
          onClick={() => {
            padRef.current?.clear();
            onChange(null);
          }}
        >
          <Eraser className="size-4" /> Borrar
        </button>
      </div>
      <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={canvasRef} className="w-full h-48 md:h-56 touch-none rounded-2xl" />
        <div className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-slate-300" />
        <span className="pointer-events-none absolute left-6 bottom-4 text-xs text-slate-400">Firme sobre la línea</span>
      </div>
    </div>
  );
}
