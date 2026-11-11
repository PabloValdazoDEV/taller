"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

/** Comprime en el navegador (máx. 1600 px, JPEG 80 %) para subir rápido desde el móvil. */
export async function comprimirImagen(f: File, max = 1600, calidad = 0.8): Promise<File> {
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("toBlob"))), "image/jpeg", calidad));
    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return f;
  }
}

/**
 * Selector de fotos con cámara. Mantiene un <input type=file name={name}> real,
 * así funciona dentro de cualquier <form> con server actions.
 * Si se pasa onChange, además informa de los ficheros (para formularios controlados).
 */
export function FotosInput({ name = "fotos", onChange, texto = "Hacer foto" }: { name?: string; onChange?: (f: File[]) => void; texto?: string }) {
  const camara = useRef<HTMLInputElement>(null);
  const real = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<{ file: File; url: string }[]>([]);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const dt = new DataTransfer();
    fotos.forEach((f) => dt.items.add(f.file));
    if (real.current) real.current.files = dt.files;
    onChange?.(fotos.map((f) => f.file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos]);

  useEffect(() => () => fotos.forEach((f) => URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function añadir(lista: FileList | null) {
    if (!lista?.length) return;
    setProcesando(true);
    const nuevas = await Promise.all(Array.from(lista).map(async (f) => {
      const c = await comprimirImagen(f);
      return { file: c, url: URL.createObjectURL(c) };
    }));
    setFotos((p) => [...p, ...nuevas]);
    setProcesando(false);
    if (camara.current) camara.current.value = "";
  }

  return (
    <div>
      <input ref={real} type="file" name={name} multiple className="hidden" tabIndex={-1} aria-hidden />
      <input ref={camara} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => añadir(e.target.files)} />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {fotos.map((f, i) => (
          <div key={f.url} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label="Quitar foto"
              onClick={() => setFotos((p) => p.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 size-7 grid place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => camara.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1 text-slate-600 hover:border-primary hover:text-primary"
        >
          <Camera className="size-7" />
          <span className="text-xs font-medium">{procesando ? "Procesando…" : texto}</span>
        </button>
      </div>
    </div>
  );
}
