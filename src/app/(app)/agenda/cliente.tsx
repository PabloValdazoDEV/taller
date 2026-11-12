"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2, Pencil, RotateCcw, UserX, X } from "lucide-react";
import { Boton, Campo, Input, Select, Textarea, cx } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import { FRANJAS, diaCorto, franja as datosFranja } from "@/lib/citas";
import { diaISO } from "@/lib/formato";
import { ESPECIALIDADES, NOMBRE_ESPECIALIDAD, type Especialidad } from "@/lib/importes";
import { textoHoras, type Horas } from "@/lib/capacidad";
import type { Prevision } from "@/lib/carga";
import { cambiarEstadoCita, datosPorMatricula, guardarCita, previsionCita } from "./actions";

export type CitaEditable = {
  id: string;
  contacto: string;
  telefono: string | null;
  matricula: string | null;
  dia: string;
  /** id de franja o «hora» */
  franja: string;
  hora: string;
  tipoOrdenId: string | null;
  motivo: string | null;
  nota: string | null;
  horas: Horas;
  necesitaSustitucion: boolean;
};
/** Tipo de trabajo con las horas que suele llevar (para proponerlas al dar la cita) */
export type Tipo = { id: string; nombre: string; horas: Horas };

const aTexto = (h: Horas) => Object.fromEntries(ESPECIALIDADES.map((e) => [e, h[e] ? String(h[e]).replace(".", ",") : ""])) as Record<Especialidad, string>;

/** Botón «Nueva cita» (se puede abrir solo con ?nueva=1, p. ej. desde la ficha de un cliente). */
export function NuevaCita({ dia, tipos, abrir = false, matricula = "" }: { dia: string; tipos: Tipo[]; abrir?: boolean; matricula?: string }) {
  const [abierto, setAbierto] = useState(abrir);
  return (
    <>
      <Boton onClick={() => setAbierto(true)}>
        <CalendarPlus className="size-4" aria-hidden /> Nueva cita
      </Boton>
      <Dialogo abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Nueva cita" descripcion="Cuándo trae el cliente el coche al taller.">
        {abierto && <FormCita tipos={tipos} inicial={{ dia: dia < diaISO() ? diaISO() : dia, matricula }} onHecho={() => setAbierto(false)} />}
      </Dialogo>
    </>
  );
}

/** Editar, «No vino», anular o volver a dejarla pendiente. */
export function AccionesCita({ cita, estado, tipos }: { cita: CitaEditable; estado: "pendiente" | "anulada" | "no_vino"; tipos: Tipo[] }) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const cambiar = (e: "pendiente" | "anulada" | "no_vino") =>
    start(async () => {
      setError("");
      const r = await cambiarEstadoCita(cita.id, e);
      if (r.error) setError(r.error);
    });
  const clase = "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50";
  return (
    <>
      {estado === "pendiente" ? (
        <>
          <button type="button" className={clase} onClick={() => setEditando(true)} disabled={pend}>
            <Pencil className="size-4" aria-hidden /> Cambiar
          </button>
          {cita.dia <= diaISO() && (
            <button type="button" className={clase} onClick={() => cambiar("no_vino")} disabled={pend}>
              <UserX className="size-4" aria-hidden /> No vino
            </button>
          )}
          <button type="button" className={cx(clase, "hover:bg-red-50 hover:text-red-700")} onClick={() => confirm(`¿Anular la cita de ${cita.contacto}?`) && cambiar("anulada")} disabled={pend}>
            <X className="size-4" aria-hidden /> Anular
          </button>
        </>
      ) : (
        <button type="button" className={clase} onClick={() => cambiar("pendiente")} disabled={pend}>
          <RotateCcw className="size-4" aria-hidden /> Deshacer
        </button>
      )}
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
      <Dialogo abierto={editando} onCerrar={() => setEditando(false)} titulo={`Cita de ${cita.contacto}`}>
        {editando && <FormCita tipos={tipos} inicial={cita} onHecho={() => setEditando(false)} />}
      </Dialogo>
    </>
  );
}

function FormCita({ tipos, inicial, onHecho }: { tipos: Tipo[]; inicial: Partial<CitaEditable>; onHecho: () => void }) {
  const router = useRouter();
  const [matricula, setMatricula] = useState(inicial.matricula ?? "");
  const [contacto, setContacto] = useState(inicial.contacto ?? "");
  const [telefono, setTelefono] = useState(inicial.telefono ?? "");
  const [franja, setFranja] = useState(inicial.franja ?? "");
  const [hora, setHora] = useState(inicial.hora ?? "");
  const [dia, setDia] = useState(inicial.dia ?? diaISO());
  const [tipo, setTipo] = useState(inicial.tipoOrdenId ?? "");
  const [horas, setHoras] = useState(() => aTexto(inicial.horas ?? tipos.find((x) => x.id === inicial.tipoOrdenId)?.horas ?? {}));
  const [sust, setSust] = useState(inicial.necesitaSustitucion ?? false);
  const [prev, setPrev] = useState<Prevision | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [vehiculo, setVehiculo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Cómo va ese día con esta cita (solo informa: siempre se puede dar)
  const claveHoras = JSON.stringify(horas);
  useEffect(() => {
    if (!franja || (franja === "hora" && !hora)) return setPrev(null);
    let vigente = true;
    setCalculando(true);
    const id = setTimeout(async () => {
      const r = formRef.current ? await previsionCita(new FormData(formRef.current)).catch(() => null) : null;
      if (vigente) {
        setPrev(r);
        setCalculando(false);
      }
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [dia, franja, hora, tipo, claveHoras, sust]);
  const lleno = prev?.nivel === "lleno" || prev?.nivel === "cerrado";

  // Coche conocido: propone el cliente y su teléfono (sin pisar lo que ya se ha escrito)
  const buscar = async (m: string) => {
    const r = await datosPorMatricula(m).catch(() => null);
    setVehiculo(r ? [r.vehiculo, r.contacto].filter(Boolean).join(" · ") || "Ya ha venido antes" : null);
    if (!r) return;
    setMatricula(r.matricula);
    setContacto((c) => c || r.contacto || "");
    setTelefono((t) => t || r.telefono || "");
  };
  useEffect(() => {
    if (inicial.matricula && !inicial.id) void buscar(inicial.matricula);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      ref={formRef}
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          setError("");
          const r = await guardarCita(fd);
          if (r.error) return setError(r.error);
          onHecho();
          if (r.dia) router.push(`/agenda?dia=${r.dia}`);
        })
      }
    >
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="franja" value={franja} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Matrícula (si la sabe)" ayuda={vehiculo ? `Conocido: ${vehiculo}` : undefined}>
          <Input name="matricula" value={matricula} onChange={(e) => setMatricula(e.target.value.toUpperCase())} onBlur={(e) => e.target.value && buscar(e.target.value)} autoCapitalize="characters" maxLength={15} className="font-mono uppercase" />
        </Campo>
        <Campo etiqueta="Teléfono">
          <Input name="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" maxLength={20} />
        </Campo>
      </div>
      <Campo etiqueta="Quién lo trae">
        <Input name="contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} required minLength={2} maxLength={120} placeholder="Nombre del cliente" />
      </Campo>
      <Campo etiqueta="Día">
        <Input type="date" name="dia" value={dia} onChange={(e) => setDia(e.target.value)} min={inicial.id ? undefined : diaISO()} required className="max-w-48" />
      </Campo>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Cuándo</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...FRANJAS.map((f) => ({ id: f.id as string, nombre: f.nombre })), { id: "hora", nombre: "Hora exacta" }].map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={franja === f.id}
              onClick={() => setFranja(f.id)}
              className={cx("min-h-11 rounded-xl border-2 px-2 text-sm font-semibold", franja === f.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}
            >
              {f.nombre}
            </button>
          ))}
        </div>
        {franja === "hora" && (
          <Input type="time" name="hora" value={hora} onChange={(e) => setHora(e.target.value)} required step={300} className="mt-2 max-w-36" aria-label="Hora" autoFocus />
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Tipo de trabajo">
          <Select
            name="tipoOrdenId"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setHoras(aTexto(tipos.find((x) => x.id === e.target.value)?.horas ?? {}));
            }}
          >
            <option value="">Sin indicar</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </Select>
        </Campo>
        <Campo etiqueta="Qué le pasa / qué quiere">
          <Input name="motivo" defaultValue={inicial.motivo ?? ""} maxLength={300} placeholder="Ej.: Revisión y ruido al frenar" />
        </Campo>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Horas de trabajo estimadas</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ESPECIALIDADES.map((e) => (
            <label key={e} className="text-xs text-slate-600">
              {NOMBRE_ESPECIALIDAD[e]}
              <Input
                name={`horas_${e}`}
                value={horas[e]}
                onChange={(ev) => setHoras((h) => ({ ...h, [e]: ev.target.value.replace(/[^\d,.]/g, "") }))}
                inputMode="decimal"
                maxLength={5}
                placeholder="0"
                className="mt-0.5 tabular-nums"
              />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Se proponen según el tipo de trabajo; cámbialas si lo sabes. Si no se puede saber hasta verlo (siniestro, avería), déjalas vacías: queda «por valorar».</p>
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3">
        <input type="checkbox" name="necesitaSustitucion" checked={sust} onChange={(e) => setSust(e.target.checked)} className="size-5 accent-slate-900" />
        <span className="text-sm font-medium">Necesita coche de sustitución</span>
      </label>
      <Campo etiqueta="Nota interna (opcional)">
        <Textarea name="nota" defaultValue={inicial.nota ?? ""} rows={2} maxLength={300} placeholder="Ej.: Trae él mismo las piezas" />
      </Campo>
      {prev && <AvisoCarga prev={prev} calculando={calculando} onDia={setDia} onFranja={setFranja} />}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend || !franja}>
          {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} {inicial.id ? (lleno ? "Guardar igualmente" : "Guardar") : lleno ? "Dar cita igualmente" : "Dar cita"}
        </Boton>
      </div>
    </form>
  );
}

/** Cómo queda el día con la cita: hueco, justo o pasado (con propuesta de otro día). Nunca bloquea. */
function AvisoCarga({ prev, calculando, onDia, onFranja }: { prev: Prevision; calculando: boolean; onDia: (d: string) => void; onFranja: (f: string) => void }) {
  const ocupa = [
    textoHoras(prev.horas) || "Horas por valorar",
    prev.dias > 1 && `ocupará ${prev.dias} días`,
    prev.porValorar > (textoHoras(prev.horas) ? 0 : 1) && `ese día ${prev.porValorar === 1 ? "hay 1 coche" : `hay ${prev.porValorar} coches`} por valorar`,
  ]
    .filter(Boolean)
    .join(" · ");
  if (prev.nivel === "libre" || prev.nivel === "justo")
    return (
      <div role="status" className={cx("flex items-start gap-2 rounded-xl px-3 py-2 text-sm", prev.nivel === "libre" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900", calculando && "opacity-60")}>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <b>{prev.nivel === "libre" ? "Ese día hay hueco." : "Ese día cabe, pero va justo."}</b> <span className="opacity-80">{ocupa}</span>
        </span>
      </div>
    );
  return (
    <div role="status" className={cx("space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950", calculando && "opacity-60")}>
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {prev.nivel === "cerrado" && prev.avisos.length === 1 ? "Ese día el taller no abre." : "Ese día no se da abasto."}
      </p>
      <ul className="list-disc space-y-0.5 pl-6">
        {prev.avisos.map((a) => <li key={a}>{a}</li>)}
      </ul>
      <p className="text-xs opacity-80">{ocupa}. Se puede dar igualmente si hace falta meterlo.</p>
      {(prev.hueco || prev.franjasLibres.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {prev.franjasLibres.map((f) => (
            <button key={f} type="button" onClick={() => onFranja(f)} className="min-h-10 rounded-xl border border-amber-400 bg-white px-3 font-semibold">
              Mejor «{datosFranja(f)?.nombre.toLowerCase()}»
            </button>
          ))}
          {prev.hueco && (
            <button type="button" onClick={() => onDia(prev.hueco!)} className="min-h-10 rounded-xl border border-amber-400 bg-white px-3 font-semibold first-letter:uppercase">
              Hay hueco el {diaCorto(`${prev.hueco}T12:00:00Z`, false)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
