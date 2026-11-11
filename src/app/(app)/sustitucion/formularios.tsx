"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, CheckCircle2, Loader2 } from "lucide-react";
import type { Dano } from "@/db/schema";
import { Boton, Campo, Input, Tarjeta, Textarea, cx } from "@/components/ui";
import { SiluetaDanos } from "@/components/silueta-danos";
import { SelectorCombustible } from "@/components/combustible";
import { PanelFirma } from "@/components/firma";
import { aniosDesde } from "@/lib/formato";
import { crearPrestamo, devolverPrestamo } from "./actions";

type Coche = { id: string; matricula: string; marca: string; modelo: string; km: number; combustible: number };

export function FormularioPrestamo(p: {
  otId: string;
  coches: Coche[];
  conductor: { nombre: string; dni: string };
  pagadorDefecto: "aseguradora" | "cortesia" | "cliente";
  edadMin: number;
  aniosCarnet: number;
  puedeForzar: boolean;
}) {
  const [cocheId, setCocheId] = useState(p.coches[0]?.id ?? "");
  const coche = p.coches.find((c) => c.id === cocheId);
  const [d, setD] = useState({
    conductorNombre: p.conductor.nombre,
    conductorDni: p.conductor.dni,
    conductorNacimiento: "",
    carnetFecha: "",
    pagador: p.pagadorDefecto,
    kmSalida: String(coche?.km ?? ""),
    combSalida: coche?.combustible ?? 8,
    forzar: false,
  });
  const [danos, setDanos] = useState<Dano[]>([]);
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }));

  const edad = d.conductorNacimiento ? aniosDesde(d.conductorNacimiento) : null;
  const carnet = d.carnetFecha ? aniosDesde(d.carnetFecha) : null;
  const okEdad = edad != null && edad >= p.edadMin;
  const okCarnet = carnet != null && carnet >= p.aniosCarnet;
  const comprobado = edad != null && carnet != null;
  const cumple = okEdad && okCarnet;

  if (!p.coches.length) return <Tarjeta className="p-6 text-center text-slate-600">No hay coches de sustitución disponibles ahora mismo.</Tarjeta>;

  return (
    <div className="space-y-5">
      <Tarjeta className="p-4 md:p-6 space-y-4">
        <span className="block text-sm font-medium text-slate-700">Coche disponible</span>
        <div className="grid sm:grid-cols-2 gap-2">
          {p.coches.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                setCocheId(c.id);
                setD((x) => ({ ...x, kmSalida: String(c.km), combSalida: c.combustible }));
              }}
              className={cx("rounded-xl border-2 p-3 text-left", cocheId === c.id ? "border-primary bg-primary/5" : "border-slate-200 bg-white")}
            >
              <div className="font-mono font-bold">{c.matricula}</div>
              <div className="text-sm">{c.marca} {c.modelo}</div>
              <div className="text-xs text-slate-500">{c.km.toLocaleString("es-ES")} km</div>
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="p-4 md:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Conductor"><Input value={d.conductorNombre} onChange={(e) => set("conductorNombre", e.target.value)} /></Campo>
          <Campo etiqueta="DNI / NIE"><Input value={d.conductorDni} onChange={(e) => set("conductorDni", e.target.value.toUpperCase())} /></Campo>
          <Campo etiqueta="Fecha de nacimiento"><Input type="date" value={d.conductorNacimiento} onChange={(e) => set("conductorNacimiento", e.target.value)} /></Campo>
          <Campo etiqueta="Fecha de expedición del carnet"><Input type="date" value={d.carnetFecha} onChange={(e) => set("carnetFecha", e.target.value)} /></Campo>
        </div>
        {comprobado && (
          <div className={cx("rounded-xl p-3 text-sm flex gap-2", cumple ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
            {cumple ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
            <div>
              <div>Edad: {edad} años {okEdad ? "✓" : `(mínimo ${p.edadMin})`} · Carnet: {carnet} años {okCarnet ? "✓" : `(mínimo ${p.aniosCarnet})`}</div>
              {!cumple && (
                p.puedeForzar ? (
                  <label className="flex items-center gap-2 mt-2 font-medium">
                    <input type="checkbox" className="size-5" checked={d.forzar} onChange={(e) => set("forzar", e.target.checked)} /> Autorizo el préstamo igualmente (quedará registrado)
                  </label>
                ) : (
                  <div className="mt-1 font-medium">Necesita autorización de administración o del jefe de taller.</div>
                )
              )}
            </div>
          </div>
        )}
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">Coste a cargo de</span>
          <div className="grid grid-cols-3 gap-2">
            {(["aseguradora", "cortesia", "cliente"] as const).map((v) => (
              <button type="button" key={v} onClick={() => set("pagador", v)} className={cx("min-h-11 rounded-xl border text-sm font-semibold", d.pagador === v ? "bg-primary text-white border-primary" : "bg-white border-slate-300")}>
                {{ aseguradora: "Aseguradora", cortesia: "Cortesía", cliente: "Cliente" }[v]}
              </button>
            ))}
          </div>
        </div>
      </Tarjeta>

      <Tarjeta className="p-4 md:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Km a la salida"><Input inputMode="numeric" value={d.kmSalida} onChange={(e) => set("kmSalida", e.target.value.replace(/\D/g, ""))} /></Campo>
          <div><span className="block text-sm font-medium text-slate-700 mb-1">Combustible</span><SelectorCombustible value={d.combSalida} onChange={(v) => set("combSalida", v)} /></div>
        </div>
        <span className="block text-sm font-medium text-slate-700">Daños existentes en el coche de sustitución</span>
        <SiluetaDanos value={danos} onChange={setDanos} />
      </Tarjeta>

      <Tarjeta className="p-4 md:p-6"><PanelFirma onChange={setFirma} etiqueta="Firma del conductor" /></Tarjeta>

      {error && <p className="rounded-xl bg-red-50 text-red-700 text-sm p-3" role="alert">{error}</p>}
      <div className="flex justify-end">
        <Boton
          variante="exito"
          className="min-h-12 px-6 text-base"
          disabled={pend || !firma || !comprobado || (!cumple && !d.forzar)}
          onClick={() => {
            const fd = new FormData();
            fd.set("datos", JSON.stringify({ ...d, otId: p.otId, cocheId, danos }));
            fd.set("firma", firma!);
            start(async () => {
              const r = await crearPrestamo(fd);
              if (r?.error) setError(r.error);
            });
          }}
        >
          {pend ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Firmar y entregar llaves
        </Boton>
      </div>
    </div>
  );
}

export function FormularioDevolucion(p: { prestamoId: string; kmSalida: number; combSalida: number; danosSalida: Dano[]; conductor: string }) {
  const [km, setKm] = useState("");
  const [comb, setComb] = useState<number | null>(null);
  const [danos, setDanos] = useState<Dano[]>(p.danosSalida);
  const [obs, setObs] = useState("");
  const [firmante, setFirmante] = useState(p.conductor);
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const nuevos = danos.length - p.danosSalida.length;

  return (
    <div className="space-y-5">
      <Tarjeta className="p-4 md:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Km a la llegada" ayuda={`Salida: ${p.kmSalida.toLocaleString("es-ES")} km${km ? ` · recorridos: ${(Number(km) - p.kmSalida).toLocaleString("es-ES")}` : ""}`}>
            <Input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} />
          </Campo>
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1">Combustible {comb != null && comb < p.combSalida && <span className="text-amber-700">(menos que a la salida)</span>}</span>
            <SelectorCombustible value={comb} onChange={setComb} />
          </div>
        </div>
        <span className="block text-sm font-medium text-slate-700">Daños (los de la salida ya están marcados; añade los nuevos)</span>
        <SiluetaDanos value={danos} onChange={setDanos} />
        {nuevos > 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{nuevos} daño(s) nuevo(s) respecto a la salida.</p>}
        <Campo etiqueta="Observaciones"><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></Campo>
      </Tarjeta>
      <Tarjeta className="p-4 md:p-6 space-y-4">
        <Campo etiqueta="Nombre de quien devuelve"><Input value={firmante} onChange={(e) => setFirmante(e.target.value)} /></Campo>
        <PanelFirma onChange={setFirma} etiqueta="Firma" />
      </Tarjeta>
      {error && <p className="rounded-xl bg-red-50 text-red-700 text-sm p-3" role="alert">{error}</p>}
      <div className="flex justify-end">
        <Boton
          variante="exito"
          className="min-h-12 px-6 text-base"
          disabled={pend || !firma || !km || comb == null}
          onClick={() => {
            const fd = new FormData();
            fd.set("datos", JSON.stringify({ prestamoId: p.prestamoId, kmLlegada: km, combLlegada: comb, danos, observaciones: obs, firmante }));
            fd.set("firma", firma!);
            start(async () => {
              const r = await devolverPrestamo(fd);
              if (r?.error) setError(r.error);
            });
          }}
        >
          {pend ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Firmar devolución
        </Boton>
      </div>
    </div>
  );
}
