"use client";

import { useState, useTransition } from "react";
import { Ban, Check, ChevronRight, Loader2, Pencil, Plus, Undo2 } from "lucide-react";
import { Boton, Campo, Input, Select, Textarea, cx } from "@/components/ui";
import { FotosInput } from "@/components/fotos-input";
import { SelectorTraspaso, sugerirMecanico, type Mecanico } from "@/components/traspaso";
import { TIPO_INCIDENCIA } from "@/lib/formato";
import { anularOT, asignarMecanico, cambiarEstado, crearIncidencia, deshacerCambioEstado, editarDatosOT, resolverIncidencia, subirFotosOT } from "../actions";

type Estado = { id: string; nombre: string; orden: number; saltable: boolean; marca: string | null; requiereAprobacion: boolean };
type Cambio = { id: string | null; nombre: string; motivo: "aprobacion" | "retroceso" | "salto" | "traspaso"; avanza: boolean };

export function FlujoEstados({
  otId,
  estados,
  actualId,
  color,
  puedeElegir,
  cerrada,
  mecanicos = [],
  mecanicoId = null,
}: {
  otId: string;
  estados: Estado[];
  actualId: string;
  color: string;
  puedeElegir: boolean;
  cerrada: boolean;
  mecanicos?: Mecanico[];
  mecanicoId?: string | null;
}) {
  const [traspaso, setTraspaso] = useState<string | null>(mecanicoId);
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  const [pendiente, setPendiente] = useState<Cambio | null>(null);
  const [nota, setNota] = useState("");
  const [deshacer, setDeshacer] = useState<string | null>(null); // nombre del estado anterior
  const actual = estados.find((e) => e.id === actualId);
  if (!actual) return <p className="text-sm text-red-600">El estado de esta orden no pertenece a su flujo.</p>;
  const siguiente = estados.find((e) => e.orden > actual.orden);

  const ir = (id: string | null, comentario?: string, mec?: string | null) =>
    start(async () => {
      setError("");
      const r = await cambiarEstado(otId, id, comentario, mec);
      if (r.error) return setError(r.error);
      setPendiente(null);
      setNota("");
      setDeshacer(actual.nombre);
    });

  /** Decide si el cambio necesita una nota antes de hacerse. */
  function pedir(id: string | null, nombre: string, orden: number) {
    setError("");
    const avanza = orden > actual!.orden;
    if (avanza) setTraspaso(sugerirMecanico(mecanicos, nombre, mecanicoId));
    if (avanza && actual!.requiereAprobacion) return setPendiente({ id, nombre, motivo: "aprobacion", avanza });
    if (!avanza) return setPendiente({ id, nombre, motivo: "retroceso", avanza });
    if (id && orden > (siguiente?.orden ?? 0)) return setPendiente({ id, nombre, motivo: "salto", avanza });
    // Al avanzar se pregunta quién hace la siguiente fase (si hay mecánicos)
    if (mecanicos.length) return setPendiente({ id, nombre, motivo: "traspaso", avanza });
    ir(id);
  }

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
                onClick={() => clicable && pedir(e.id, e.nombre, e.orden)}
                className={cx(
                  "inline-flex items-center gap-1 rounded-full px-3 min-h-10 text-xs font-semibold border transition",
                  esActual ? "text-white border-transparent shadow" : hecho ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-white text-slate-600 border-slate-200",
                  clicable && "hover:border-slate-400",
                  e.saltable && !esActual && !hecho && "border-dashed",
                )}
                style={esActual ? { background: color } : undefined}
                title={e.saltable ? "Paso opcional" : e.requiereAprobacion ? "Requiere aprobación del cliente" : undefined}
              >
                {hecho && <Check className="size-3" />} {e.nombre}
              </button>
            </li>
          );
        })}
      </ol>

      {pendiente ? (
        <form
          className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            ir(pendiente.id, nota, pendiente.avanza && mecanicos.length ? traspaso : undefined);
          }}
        >
          {pendiente.motivo !== "traspaso" && (
            <>
              <p className="text-sm font-semibold">
                {pendiente.motivo === "aprobacion"
                  ? `Pasar a «${pendiente.nombre}»: ¿cómo ha aprobado el cliente?`
                  : pendiente.motivo === "retroceso"
                    ? `Volver a «${pendiente.nombre}»: ¿por qué?`
                    : `Saltar a «${pendiente.nombre}»: ¿por qué?`}
              </p>
              <Input
                autoFocus
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                required={pendiente.motivo === "aprobacion"}
                placeholder={pendiente.motivo === "aprobacion" ? "Ej.: Aprobado por teléfono, 450 € + IVA" : "Opcional"}
              />
            </>
          )}
          {pendiente.avanza && mecanicos.length > 0 && (
            <SelectorTraspaso mecanicos={mecanicos} valor={traspaso} onChange={setTraspaso} actualId={mecanicoId} fase={pendiente.nombre} />
          )}
          <div className="flex gap-2 justify-end">
            <Boton type="button" variante="fantasma" onClick={() => setPendiente(null)} disabled={pend}>Cancelar</Boton>
            <Boton type="submit" disabled={pend || (pendiente.motivo === "aprobacion" && nota.trim().length < 3)}>
              {pend && <Loader2 className="size-4 animate-spin" />} Confirmar
            </Boton>
          </div>
        </form>
      ) : (
        !cerrada &&
        siguiente &&
        siguiente.marca !== "final" && (
          <Boton className="mt-3 w-full sm:w-auto" onClick={() => pedir(null, siguiente.nombre, siguiente.orden)} disabled={pend}>
            {pend ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
            {actual.requiereAprobacion ? `Cliente aprueba → «${siguiente.nombre}»` : `Pasar a «${siguiente.nombre}»`}
          </Boton>
        )
      )}
      {deshacer && !pendiente && <BotonDeshacer otId={otId} anterior={deshacer} onHecho={() => setDeshacer(null)} />}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

/** «Deshacer» tras un cambio de estado propio (el servidor lo permite durante 10 minutos). */
export function BotonDeshacer({ otId, anterior, onHecho }: { otId: string; anterior: string; onHecho: () => void }) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-emerald-700 font-medium">Estado cambiado.</span>
      <button
        type="button"
        disabled={pend}
        className="inline-flex items-center gap-1 rounded-lg px-3 min-h-10 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
        onClick={() =>
          start(async () => {
            const r = await deshacerCambioEstado(otId);
            if (r.error) setError(r.error);
            else onHecho();
          })
        }
      >
        {pend ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Deshacer (volver a «{anterior}»)
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}

export function AsignarMecanico({ otId, actual, mecanicos }: { otId: string; actual: string | null; mecanicos: { id: string; nombre: string }[] }) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <Select
        value={actual ?? ""}
        disabled={pend}
        onChange={(e) =>
          start(async () => {
            setError("");
            const r = await asignarMecanico(otId, e.target.value || null);
            if (r.error) setError(r.error);
          })
        }
        aria-label="Mecánico asignado"
      >
        <option value="">Sin asignar</option>
        {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function NuevaIncidencia({ otId, esOficina = true }: { otId: string; esOficina?: boolean }) {
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
      {esOficina && (tipo === "retraso_piezas" || tipo === "averia_adicional") && (
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
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const enviar = (descartar: boolean) =>
    start(async () => {
      setError("");
      const r = await resolverIncidencia(id, texto, descartar);
      if (r.error) setError(r.error);
    });
  const cerrar = () => {
    setAbierto(false);
    setTexto("");
    setError("");
  };
  if (!abierto)
    return (
      <Boton variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setAbierto(true)}>
        Resolver
      </Boton>
    );
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && cerrar()}
        placeholder="Cómo se ha resuelto (p. ej. «Cliente aprueba por teléfono»)"
        className="flex-1 sm:min-w-64"
        autoFocus
      />
      <Boton disabled={pend} onClick={() => enviar(false)}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Resuelta</Boton>
      <Boton variante="secundario" disabled={pend} onClick={() => enviar(true)} title="La incidencia no procede: se cierra sin hacer nada">Descartar incidencia</Boton>
      <Boton variante="fantasma" disabled={pend} onClick={cerrar}>Cancelar</Boton>
      {error && <p className="text-sm text-red-600 sm:self-center">{error}</p>}
    </div>
  );
}

export function SubirFotos({ otId }: { otId: string }) {
  const [pend, start] = useTransition();
  const [clave, setClave] = useState(0);
  const [hay, setHay] = useState(false);
  const [aviso, setAviso] = useState("");
  return (
    <form
      key={clave}
      action={(fd) =>
        start(async () => {
          const r = await subirFotosOT(fd);
          setAviso(r.error ?? "");
          if (!r.error || !r.error.startsWith("No se ha")) {
            setClave((k) => k + 1);
            setHay(false);
          }
        })
      }
      className="space-y-2"
    >
      <input type="hidden" name="otId" value={otId} />
      <FotosInput name="fotos" texto="Añadir" onChange={(f) => setHay(f.length > 0)} />
      {hay && <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" />} Subir fotos</Boton>}
      {aviso && <p className="text-sm text-red-600">{aviso}</p>}
    </form>
  );
}

type DatosEditables = {
  trabajo: string;
  fechaPrevista: string | null;
  siniestro: { companiaId?: string; numeroSiniestro?: string; numeroPoliza?: string; perito?: string; fechaPeritaje?: string; franquicia?: number; cubreSustitucion?: boolean } | null;
};

/** Corregir datos de gestión de la orden (no altera los documentos ya firmados). */
export function EditarDatosOT({ otId, datos, conSiniestro, companias }: { otId: string; datos: DatosEditables; conSiniestro: boolean; companias: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  if (!abierto)
    return (
      <Boton variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setAbierto(true)}>
        <Pencil className="size-4" /> Editar datos
      </Boton>
    );
  const sin = datos.siniestro ?? {};
  return (
    <form
      className="fixed inset-0 z-40 bg-slate-900/40 grid place-items-center p-4 overflow-y-auto"
      action={(fd) =>
        start(async () => {
          setError("");
          const r = await editarDatosOT(fd);
          if (r.error) setError(r.error);
          else setAbierto(false);
        })
      }
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold">Editar datos de la orden</h2>
        <input type="hidden" name="otId" value={otId} />
        <Campo etiqueta="Trabajo solicitado"><Textarea name="trabajo" defaultValue={datos.trabajo} rows={3} required /></Campo>
        <Campo etiqueta="Fecha prevista de entrega"><Input type="date" name="fechaPrevista" defaultValue={datos.fechaPrevista ?? ""} /></Campo>
        {conSiniestro && (
          <fieldset className="grid sm:grid-cols-2 gap-3 rounded-xl bg-violet-50 p-3">
            <legend className="text-sm font-semibold text-violet-800 px-1">Compañía / siniestro</legend>
            <Campo etiqueta="Compañía" className="sm:col-span-2">
              <Select name="companiaId" defaultValue={sin.companiaId ?? ""}>
                <option value="">— Sin compañía —</option>
                {companias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </Campo>
            <Campo etiqueta="Nº siniestro / autorización"><Input name="numeroSiniestro" defaultValue={sin.numeroSiniestro ?? ""} /></Campo>
            <Campo etiqueta="Nº póliza / contrato"><Input name="numeroPoliza" defaultValue={sin.numeroPoliza ?? ""} /></Campo>
            <Campo etiqueta="Perito"><Input name="perito" defaultValue={sin.perito ?? ""} /></Campo>
            <Campo etiqueta="Fecha de peritaje"><Input type="date" name="fechaPeritaje" defaultValue={sin.fechaPeritaje ?? ""} /></Campo>
            <Campo etiqueta="Franquicia (€)"><Input name="franquicia" inputMode="decimal" defaultValue={sin.franquicia ?? ""} /></Campo>
            <label className="flex items-center gap-2 text-sm self-end min-h-11">
              <input type="checkbox" name="cubreSustitucion" defaultChecked={!!sin.cubreSustitucion} className="size-5" /> Cubre coche de sustitución
            </label>
          </fieldset>
        )}
        <p className="text-xs text-slate-500">Los documentos ya firmados no cambian: el resguardo sigue mostrando los datos del momento de la firma. El cambio queda registrado.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
          <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" />} Guardar</Boton>
        </div>
      </div>
    </form>
  );
}

/** Anular una orden (solo administración), con motivo obligatorio. */
export function AnularOT({ otId }: { otId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-semibold text-red-700 hover:bg-red-50">
        <Ban className="size-4" /> Anular orden
      </button>
    );
  return (
    <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
      <p className="text-sm font-semibold text-red-900">Anular la orden (alta por error, duplicada…). No genera acta de entrega.</p>
      <Input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la anulación" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)} disabled={pend}>Cancelar</Boton>
        <Boton
          type="button"
          variante="peligro"
          disabled={pend || motivo.trim().length < 3}
          onClick={() =>
            start(async () => {
              const r = await anularOT(otId, motivo);
              if (r.error) setError(r.error);
            })
          }
        >
          {pend && <Loader2 className="size-4 animate-spin" />} Anular definitivamente
        </Boton>
      </div>
    </div>
  );
}
