"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Pencil, Plus, RotateCcw, UserX } from "lucide-react";
import { Boton, Campo, Input, Pastilla, Tarjeta, cx } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import { INFO_PUESTO, PUESTOS, type Puesto } from "@/lib/puestos";
import type { Empleado } from "@/lib/data";
import { cambiarActivoEmpleado, guardarEmpleado } from "../actions";

const COLORES = ["#0f172a", "#b91c1c", "#c2410c", "#b45309", "#15803d", "#0f766e", "#0369a1", "#1d4ed8", "#7c3aed", "#be185d", "#475569"];

export function ListaEmpleados({ empleados, yoId }: { empleados: Empleado[]; yoId: string }) {
  const [editando, setEditando] = useState<Empleado | "nuevo" | null>(null);
  const [error, setError] = useState("");
  const [pendId, setPendId] = useState<string | null>(null);
  const [, start] = useTransition();
  const activos = empleados.filter((e) => e.activo);
  const bajas = empleados.filter((e) => !e.activo);

  function cambiarActivo(e: Empleado, activo: boolean) {
    if (!activo && !confirm(`¿Dar de baja a ${e.nombre}? No podrá entrar en la app.${e.trabajosAbiertos ? ` Sus ${e.trabajosAbiertos} trabajo(s) abiertos quedarán sin asignar.` : ""} Su historial se conserva.`)) return;
    setPendId(e.id);
    start(async () => {
      const r = await cambiarActivoEmpleado(e.id, activo);
      setError(r.error ?? "");
      setPendId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {activos.length} empleado(s) activos. Cada persona puede tener <b>varios puestos</b>: su pantalla de inicio junta lo de todos.
        </p>
        <Boton onClick={() => setEditando("nuevo")}>
          <Plus className="size-4" aria-hidden /> Nuevo empleado
        </Boton>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Tarjeta className="divide-y divide-slate-100">
        {activos.map((e) => (
          <FilaEmpleado key={e.id} e={e} yo={e.id === yoId} pendiente={pendId === e.id} onEditar={() => setEditando(e)} onActivo={(v) => cambiarActivo(e, v)} />
        ))}
      </Tarjeta>

      {bajas.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-600 py-2">Dados de baja ({bajas.length})</summary>
          <Tarjeta className="divide-y divide-slate-100 mt-2 opacity-80">
            {bajas.map((e) => (
              <FilaEmpleado key={e.id} e={e} yo={false} pendiente={pendId === e.id} onEditar={() => setEditando(e)} onActivo={(v) => cambiarActivo(e, v)} />
            ))}
          </Tarjeta>
        </details>
      )}

      <Dialogo
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={editando === "nuevo" ? "Nuevo empleado" : `Editar a ${editando?.nombre ?? ""}`}
        descripcion={editando === "nuevo" ? "Entrará en la app eligiendo su nombre y tecleando su PIN." : undefined}
      >
        {editando !== null && <FormEmpleado e={editando === "nuevo" ? null : editando} yo={editando !== "nuevo" && editando.id === yoId} onHecho={() => setEditando(null)} />}
      </Dialogo>
    </div>
  );
}

function FilaEmpleado({ e, yo, pendiente, onEditar, onActivo }: { e: Empleado; yo: boolean; pendiente: boolean; onEditar: () => void; onActivo: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: e.color }} aria-hidden>
        {e.nombre[0]}
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <div className="font-semibold">
          {e.nombre} {yo && <span className="text-xs font-normal text-slate-500">(tú)</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {PUESTOS.filter((p) => e.puestos.includes(p)).map((p) => (
            <Pastilla key={p} className="bg-slate-100 text-slate-700">{INFO_PUESTO[p].nombre}</Pastilla>
          ))}
          {e.trabajosAbiertos > 0 && <span className="text-xs text-slate-500 self-center">· {e.trabajosAbiertos} trabajo(s) abiertos</span>}
        </div>
      </div>
      <div className="flex gap-2">
        <Boton variante="secundario" className="min-h-10" onClick={onEditar}>
          <Pencil className="size-4" aria-hidden /> Editar
        </Boton>
        {e.activo ? (
          !yo && (
            <Boton variante="fantasma" className="min-h-10 text-red-700 hover:bg-red-50" onClick={() => onActivo(false)} disabled={pendiente}>
              {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserX className="size-4" aria-hidden />} Dar de baja
            </Boton>
          )
        ) : (
          <Boton variante="fantasma" className="min-h-10" onClick={() => onActivo(true)} disabled={pendiente}>
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />} Reactivar
          </Boton>
        )}
      </div>
    </div>
  );
}

function FormEmpleado({ e, yo, onHecho }: { e: Empleado | null; yo: boolean; onHecho: () => void }) {
  const [color, setColor] = useState(e?.color ?? COLORES[6]);
  const [puestos, setPuestos] = useState<Puesto[]>(e?.puestos ?? []);
  const [cambiarPin, setCambiarPin] = useState(!e);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  const alternar = (p: Puesto) => setPuestos((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p]));

  return (
    <form
      className="space-y-5"
      action={(fd) =>
        start(async () => {
          const r = await guardarEmpleado(fd);
          if (r.error) setError(r.error);
          else onHecho();
        })
      }
    >
      {e && <input type="hidden" name="id" value={e.id} />}
      <input type="hidden" name="color" value={color} />
      <Campo etiqueta="Nombre">
        <Input name="nombre" defaultValue={e?.nombre} required minLength={2} maxLength={40} autoComplete="off" placeholder="Ej.: Laura" />
      </Campo>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Puestos <span className="font-normal text-slate-500">(puedes marcar varios)</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PUESTOS.map((p) => {
            const marcado = puestos.includes(p);
            const bloqueado = yo && p === "direccion" && marcado;
            return (
              <label
                key={p}
                className={cx(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                  marcado ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300",
                  bloqueado && "cursor-not-allowed",
                )}
              >
                <input type="checkbox" name="puestos" value={p} checked={marcado} onChange={() => !bloqueado && alternar(p)} className="mt-0.5 size-5 shrink-0 accent-slate-900" />
                <span>
                  <span className="block text-sm font-semibold">{INFO_PUESTO[p].nombre}</span>
                  <span className="block text-xs text-slate-500">{bloqueado ? "No puedes quitarte Dirección a ti mismo." : INFO_PUESTO[p].descripcion}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Color <span className="font-normal text-slate-500">(para reconocerle en el tablero)</span></legend>
        <div className="flex flex-wrap gap-2">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={cx("size-10 rounded-full ring-offset-2 transition", color === c ? "ring-2 ring-slate-900" : "hover:scale-105")}
              style={{ background: c }}
            />
          ))}
        </div>
      </fieldset>

      {cambiarPin ? (
        <Campo etiqueta={e ? "Nuevo PIN" : "PIN de acceso"} ayuda="4 cifras. Díselo en persona; no se puede volver a consultar.">
          <Input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoComplete="new-password" placeholder="••••" className="max-w-40 tracking-[0.5em] font-mono" />
        </Campo>
      ) : (
        <Boton type="button" variante="secundario" onClick={() => setCambiarPin(true)}>
          <KeyRound className="size-4" aria-hidden /> Cambiar PIN
        </Boton>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend || puestos.length === 0}>
          {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} {e ? "Guardar cambios" : "Crear empleado"}
        </Boton>
      </div>
    </form>
  );
}
