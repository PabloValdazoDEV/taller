"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Boton, Campo, Input, Matricula, Pastilla, Tarjeta, Textarea, Vacio } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import { SelectorMarcaModelo, LogoMarca } from "@/components/selector-marca-modelo";
import { SelectorCombustible } from "@/components/combustible";
import { SiluetaDanos, VistasDanos } from "@/components/silueta-danos";
import type { Dano } from "@/db/schema";
import { diaISO, fmtCombustible, fmtFecha, fmtKm } from "@/lib/formato";
import type { CocheConfig } from "@/lib/data";
import { eliminarCoche, guardarCoche, reactivarCoche } from "../actions";

const ESTADO = { disponible: ["Disponible", "#047857"], prestado: ["Prestado", "#b45309"], mantenimiento: ["En mantenimiento", "#475569"] } as const;

const hoyMas = (dias: number) => diaISO(new Date(Date.now() + dias * 86400_000));

export function ListaCoches({ coches }: { coches: CocheConfig[] }) {
  const [editando, setEditando] = useState<CocheConfig | "nuevo" | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);
  const [pendId, setPendId] = useState<string | null>(null);
  const [, start] = useTransition();
  const activos = coches.filter((c) => c.coche.activo);
  const bajas = coches.filter((c) => !c.coche.activo);

  function eliminar(c: CocheConfig) {
    const msg = c.prestamos
      ? `${c.coche.matricula} tiene ${c.prestamos} préstamo(s) con documentos firmados, así que se dará de baja (no se borra su historial). ¿Continuar?`
      : `¿Eliminar definitivamente ${c.coche.matricula}? No se ha prestado nunca.`;
    if (!confirm(msg)) return;
    setPendId(c.coche.id);
    start(async () => {
      const r = await eliminarCoche(c.coche.id);
      setAviso(r.error ? { tipo: "error", texto: r.error } : { tipo: "ok", texto: r.baja ? `${c.coche.matricula} dado de baja.` : `${c.coche.matricula} eliminado.` });
      setPendId(null);
    });
  }
  function reactivar(c: CocheConfig) {
    setPendId(c.coche.id);
    start(async () => {
      const r = await reactivarCoche(c.coche.id);
      setAviso(r.error ? { tipo: "error", texto: r.error } : { tipo: "ok", texto: `${c.coche.matricula} vuelve a estar disponible.` });
      setPendId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{activos.length} coche(s) en la flota. Los préstamos se hacen desde la orden del cliente.</p>
        <Boton onClick={() => setEditando("nuevo")}>
          <Plus className="size-4" aria-hidden /> Añadir coche
        </Boton>
      </div>
      {aviso && (
        <p role={aviso.tipo === "error" ? "alert" : "status"} className={aviso.tipo === "error" ? "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" : "rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"}>
          {aviso.texto}
        </p>
      )}

      {activos.length === 0 ? (
        <Tarjeta><Vacio>Todavía no hay coches de sustitución. Añade el primero.</Vacio></Tarjeta>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {activos.map((c) => (
            <FichaCoche key={c.coche.id} c={c} pendiente={pendId === c.coche.id} onEditar={() => setEditando(c)} onEliminar={() => eliminar(c)} />
          ))}
        </div>
      )}

      {bajas.length > 0 && (
        <details>
          <summary className="cursor-pointer select-none py-2 text-sm font-medium text-slate-600">Dados de baja ({bajas.length})</summary>
          <Tarjeta className="mt-2 divide-y divide-slate-100">
            {bajas.map((c) => (
              <div key={c.coche.id} className="flex flex-wrap items-center gap-3 p-4">
                <Matricula>{c.coche.matricula}</Matricula>
                <span className="flex-1 text-sm">{c.coche.marca} {c.coche.modelo} · {c.prestamos} préstamo(s)</span>
                <Boton variante="fantasma" className="min-h-10" onClick={() => reactivar(c)} disabled={pendId === c.coche.id}>
                  <RotateCcw className="size-4" aria-hidden /> Reactivar
                </Boton>
              </div>
            ))}
          </Tarjeta>
        </details>
      )}

      <Dialogo abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === "nuevo" ? "Añadir coche de sustitución" : `Editar ${editando?.coche.matricula ?? ""}`}>
        {editando !== null && <FormCoche c={editando === "nuevo" ? null : editando} onHecho={() => setEditando(null)} />}
      </Dialogo>
    </div>
  );
}

function FichaCoche({ c, pendiente, onEditar, onEliminar }: { c: CocheConfig; pendiente: boolean; onEditar: () => void; onEliminar: () => void }) {
  const k = c.coche;
  const [txt, color] = ESTADO[k.estado];
  const en30 = hoyMas(30);
  const alertas = [k.itvHasta && k.itvHasta < en30 && `ITV ${k.itvHasta < hoyMas(0) ? "caducada" : "caduca pronto"}`, k.seguroHasta && k.seguroHasta < en30 && `Seguro ${k.seguroHasta < hoyMas(0) ? "caducado" : "caduca pronto"}`].filter(Boolean) as string[];
  return (
    <Tarjeta className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <LogoMarca marca={k.marca} className="size-8" />
          <div>
            <Matricula>{k.matricula}</Matricula>
            <div className="text-sm font-semibold">{k.marca} {k.modelo}</div>
          </div>
        </div>
        <Pastilla color={color}>{txt}</Pastilla>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex gap-1"><dt className="text-slate-500">Km</dt><dd className="font-medium">{fmtKm(k.km)}</dd></div>
        <div className="flex gap-1"><dt className="text-slate-500">Combustible</dt><dd className="font-medium">{fmtCombustible(k.combustible)}</dd></div>
        <div className="flex gap-1"><dt className="text-slate-500">ITV</dt><dd className="font-medium">{fmtFecha(k.itvHasta)}</dd></div>
        <div className="flex gap-1"><dt className="text-slate-500">Seguro</dt><dd className="font-medium">{fmtFecha(k.seguroHasta)}</dd></div>
        <div className="col-span-2 flex gap-1"><dt className="text-slate-500">Daños</dt><dd className="font-medium">{k.danos.length ? `${k.danos.length} registrado(s)` : "Ninguno"}</dd></div>
        <div className="col-span-2 flex gap-1"><dt className="text-slate-500">Préstamos</dt><dd className="font-medium">{c.prestamos}{c.ultimoPrestamo && <span className="font-normal text-slate-500"> · último {fmtFecha(c.ultimoPrestamo)}</span>}</dd></div>
      </dl>
      {alertas.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {alertas.join(" · ")}
        </p>
      )}
      {k.notas && <p className="text-sm text-slate-600">{k.notas}</p>}
      {k.danos.length > 0 && (
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">Ver daños</summary>
          <div className="border-t border-slate-100 p-3"><VistasDanos danos={k.danos} conLista /></div>
        </details>
      )}
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <Boton variante="secundario" className="min-h-10" onClick={onEditar}>
          <Pencil className="size-4" aria-hidden /> Editar
        </Boton>
        <Boton variante="fantasma" className="min-h-10 text-red-700 hover:bg-red-50" onClick={onEliminar} disabled={pendiente || k.estado === "prestado"} title={k.estado === "prestado" ? "Está prestado: registra antes la devolución" : undefined}>
          {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} {c.prestamos ? "Dar de baja" : "Eliminar"}
        </Boton>
      </div>
    </Tarjeta>
  );
}

function FormCoche({ c, onHecho }: { c: CocheConfig | null; onHecho: () => void }) {
  const k = c?.coche;
  const prestado = k?.estado === "prestado";
  const [marca, setMarca] = useState(k?.marca ?? "");
  const [modelo, setModelo] = useState(k?.modelo ?? "");
  const [comb, setComb] = useState<number>(k?.combustible ?? 8);
  const [danos, setDanos] = useState<Dano[]>(k?.danos ?? []);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await guardarCoche(fd);
          if (r.error) setError(r.error);
          else onHecho();
        })
      }
    >
      {k && <input type="hidden" name="id" value={k.id} />}
      <input type="hidden" name="marca" value={marca} />
      <input type="hidden" name="modelo" value={modelo} />
      <input type="hidden" name="danos" value={JSON.stringify(danos)} />
      <Campo etiqueta="Matrícula">
        <Input name="matricula" defaultValue={k?.matricula} required autoComplete="off" placeholder="1234 ABC" className="max-w-48 font-mono uppercase tracking-wider" />
      </Campo>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Marca y modelo</span>
        <SelectorMarcaModelo marca={marca} modelo={modelo} onChange={(m, mo) => { setMarca(m); setModelo(mo); }} />
      </div>
      {prestado ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Está prestado: los km y el combustible se actualizarán con la devolución firmada.</p>
      ) : (
        <>
          <Campo etiqueta="Kilómetros">
            <Input name="km" type="number" inputMode="numeric" min={0} defaultValue={k?.km ?? ""} className="max-w-48" />
          </Campo>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Combustible actual</span>
            <SelectorCombustible name="combustible" value={comb} onChange={setComb} />
          </div>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="ITV válida hasta"><Input name="itvHasta" type="date" defaultValue={k?.itvHasta ?? ""} /></Campo>
        <Campo etiqueta="Seguro válido hasta"><Input name="seguroHasta" type="date" defaultValue={k?.seguroHasta ?? ""} /></Campo>
      </div>
      <div className="space-y-2">
        <div>
          <span className="block text-sm font-medium text-slate-700">Daños que tiene el coche</span>
          <span className="block text-xs text-slate-500">
            {prestado ? "Está prestado: se actualizarán con la devolución firmada." : "Se precargan en cada préstamo. Quita los que se hayan reparado."}
          </span>
        </div>
        {prestado ? <VistasDanos danos={danos} conLista /> : <SiluetaDanos value={danos} onChange={setDanos} />}
      </div>
      {!prestado && (
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
          <input type="checkbox" name="enMantenimiento" defaultChecked={k?.estado === "mantenimiento"} className="size-5 accent-slate-900" />
          <span><b>En mantenimiento</b> <span className="text-slate-500">— no se podrá prestar hasta desmarcarlo</span></span>
        </label>
      )}
      <Campo etiqueta="Notas"><Textarea name="notas" rows={2} defaultValue={k?.notas ?? ""} placeholder="Ej.: rueda de repuesto de galleta, silla infantil en el maletero…" /></Campo>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend || !marca || !modelo}>
          {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} {k ? "Guardar cambios" : "Añadir coche"}
        </Boton>
      </div>
    </form>
  );
}
