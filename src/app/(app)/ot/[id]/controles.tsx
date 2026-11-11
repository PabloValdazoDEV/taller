"use client";

import { useState, useTransition } from "react";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";
import { Boton, Campo, Input, Select, Textarea, cx } from "@/components/ui";
import { FotosInput } from "@/components/fotos-input";
import { TIPO_INCIDENCIA } from "@/lib/formato";
import { asignarMecanico, cambiarEstado, crearIncidencia, resolverIncidencia, subirFotosOT } from "../actions";

type Estado = { id: string; nombre: string; orden: number; saltable: boolean; marca: string | null };

export function FlujoEstados({ otId, estados, actualId, color, puedeElegir, cerrada }: { otId: string; estados: Estado[]; actualId: string; color: string; puedeElegir: boolean; cerrada: boolean }) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  const actual = estados.find((e) => e.id === actualId)!;
  const siguiente = estados.find((e) => e.orden > actual.orden);

  const ir = (id: string | null) =>
    start(async () => {
      setError("");
      const r = await cambiarEstado(otId, id);
      if (r.error) setError(r.error);
    });

  return (
    <div>
      <ol className="flex flex-wrap gap-1.5">
        {estados.map((e) => {
          const hecho = e.orden < actual.orden;
          const esActual = e.id === actualId;
          const clicable = puedeElegir && !cerrada && !esActual && e.marca !== "final";
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={!clicable || pend}
                onClick={() => clicable && confirm(`¿Cambiar el estado a «${e.nombre}»?`) && ir(e.id)}
                className={cx(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                  esActual ? "text-white border-transparent shadow" : hecho ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-white text-slate-600 border-slate-200",
                  clicable && "hover:border-slate-400",
                  e.saltable && !esActual && !hecho && "border-dashed",
                )}
                style={esActual ? { background: color } : undefined}
                title={e.saltable ? "Paso opcional" : undefined}
              >
                {hecho && <Check className="size-3" />} {e.nombre}
              </button>
            </li>
          );
        })}
      </ol>
      {!cerrada && siguiente && siguiente.marca !== "final" && (
        <Boton className="mt-3 w-full sm:w-auto" onClick={() => ir(null)} disabled={pend}>
          {pend ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />} Pasar a «{siguiente.nombre}»
        </Boton>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export function AsignarMecanico({ otId, actual, mecanicos }: { otId: string; actual: string | null; mecanicos: { id: string; nombre: string }[] }) {
  const [pend, start] = useTransition();
  return (
    <Select
      value={actual ?? ""}
      disabled={pend}
      onChange={(e) => start(async () => void (await asignarMecanico(otId, e.target.value || null)))}
      aria-label="Mecánico asignado"
    >
      <option value="">Sin asignar</option>
      {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
    </Select>
  );
}

export function NuevaIncidencia({ otId }: { otId: string }) {
  const [abierta, setAbierta] = useState(false);
  const [tipo, setTipo] = useState("averia_adicional");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  if (!abierta)
    return (
      <Boton variante="secundario" onClick={() => setAbierta(true)} className="w-full sm:w-auto">
        <Plus className="size-4" /> Nueva incidencia
      </Boton>
    );

  return (
    <form
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/50 p-4"
      action={(fd) =>
        start(async () => {
          setError("");
          const r = await crearIncidencia(fd);
          if (r.error) setError(r.error);
          else setAbierta(false);
        })
      }
    >
      <input type="hidden" name="otId" value={otId} />
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(TIPO_INCIDENCIA).map(([k, v]) => (
          <label key={k} className={cx("min-h-11 rounded-xl border px-3 flex items-center gap-2 text-sm font-medium cursor-pointer", tipo === k ? "border-amber-500 bg-amber-100" : "bg-white border-slate-200")}>
            <input type="radio" name="tipo" value={k} checked={tipo === k} onChange={() => setTipo(k)} className="sr-only" />
            {v}
          </label>
        ))}
      </div>
      <Campo etiqueta="Descripción">
        <Textarea name="descripcion" required rows={3} placeholder={tipo === "averia_adicional" ? "Qué se ha encontrado y qué habría que hacer" : ""} />
      </Campo>
      {(tipo === "retraso_piezas" || tipo === "averia_adicional") && (
        <Campo etiqueta="Nueva fecha prevista de entrega (si cambia)"><Input type="date" name="nuevaFecha" /></Campo>
      )}
      {tipo === "dano_taller" && <p className="text-xs text-amber-800">Uso interno: no se mostrará al cliente.</p>}
      {tipo === "averia_adicional" && <p className="text-xs text-amber-800">Requiere aprobación del cliente (presupuesto complementario).</p>}
      <FotosInput name="fotos" texto="Foto" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Boton type="button" variante="fantasma" onClick={() => setAbierta(false)}>Cancelar</Boton>
        <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" />} Guardar incidencia</Boton>
      </div>
    </form>
  );
}

export function ResolverIncidencia({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pend, start] = useTransition();
  if (!abierto) return <button className="text-xs font-semibold text-primary" onClick={() => setAbierto(true)}>Resolver</button>;
  return (
    <div className="mt-2 flex flex-col sm:flex-row gap-2">
      <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cómo se ha resuelto (p. ej. «Cliente aprueba por teléfono»)" className="flex-1" />
      <Boton disabled={pend} onClick={() => start(async () => void (await resolverIncidencia(id, texto)))}>Resuelta</Boton>
      <Boton variante="fantasma" disabled={pend} onClick={() => start(async () => void (await resolverIncidencia(id, texto, true)))}>Descartar</Boton>
    </div>
  );
}

export function SubirFotos({ otId }: { otId: string }) {
  const [pend, start] = useTransition();
  const [clave, setClave] = useState(0);
  const [hay, setHay] = useState(false);
  return (
    <form
      key={clave}
      action={(fd) => start(async () => { await subirFotosOT(fd); setClave((k) => k + 1); setHay(false); })}
      className="space-y-2"
    >
      <input type="hidden" name="otId" value={otId} />
      <FotosInput name="fotos" texto="Añadir" onChange={(f) => setHay(f.length > 0)} />
      {hay && <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" />} Subir fotos</Boton>}
    </form>
  );
}
