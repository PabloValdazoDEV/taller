"use client";

import { useState, useTransition } from "react";
import { Delete } from "lucide-react";
import { entrarConPin } from "./actions";

type U = { id: string; nombre: string; rolNombre: string; color: string; cifras: number };

export function PinLogin({ usuarios }: { usuarios: U[] }) {
  const [sel, setSel] = useState<U | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();

  function pulsar(d: string) {
    if (pendiente) return;
    setError("");
    if (!sel) return;
    const nuevo = (pin + d).slice(0, sel.cifras);
    setPin(nuevo);
    if (nuevo.length === sel.cifras) {
      start(async () => {
        const r = await entrarConPin(sel.id, nuevo);
        if (r?.error) {
          setError(r.error);
          setPin("");
        }
      });
    }
  }

  if (!sel)
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {usuarios.map((u) => (
          <button
            key={u.id}
            onClick={() => setSel(u)}
            className="rounded-2xl bg-white border border-slate-200 p-4 text-left shadow-sm hover:border-primary hover:shadow transition"
          >
            <div className="size-12 rounded-full grid place-items-center text-white font-bold text-lg mb-3" style={{ background: u.color }}>
              {u.nombre[0]}
            </div>
            <div className="font-semibold">{u.nombre}</div>
            <div className="text-xs text-slate-500">{u.rolNombre}</div>
          </button>
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-xs text-center">
      <div className="size-16 mx-auto rounded-full grid place-items-center text-white font-bold text-2xl mb-2" style={{ background: sel.color }}>
        {sel.nombre[0]}
      </div>
      <div className="font-semibold text-lg">{sel.nombre}</div>
      <div className="flex justify-center gap-3 my-5" aria-label="PIN">
        {Array.from({ length: sel.cifras }, (_, i) => i).map((i) => (
          <span key={i} className={`size-4 rounded-full border-2 border-slate-400 ${pin.length > i ? "bg-slate-800 border-slate-800" : ""}`} />
        ))}
      </div>
      <p className="h-5 text-sm text-red-600 mb-2" role="alert">{error}</p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <TeclaPin key={d} onClick={() => pulsar(d)}>{d}</TeclaPin>
        ))}
        <button className="text-sm text-slate-500 hover:text-slate-800" onClick={() => { setSel(null); setPin(""); setError(""); }}>
          Cambiar
        </button>
        <TeclaPin onClick={() => pulsar("0")}>0</TeclaPin>
        <button aria-label="Borrar" className="grid place-items-center text-slate-500 hover:text-slate-800" onClick={() => setPin(pin.slice(0, -1))}>
          <Delete />
        </button>
      </div>
    </div>
  );
}

function TeclaPin(p: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={p.onClick} className="h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-semibold shadow-sm active:bg-slate-100">
      {p.children}
    </button>
  );
}
