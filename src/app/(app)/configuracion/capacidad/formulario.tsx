"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Boton, Campo, Input, Tarjeta, cx } from "@/components/ui";
import { ESPECIALIDADES, NOMBRE_ESPECIALIDAD, type Especialidad } from "@/lib/importes";
import { DIAS_SEMANA, fmtH, nombreEspecialidades, type Horas } from "@/lib/capacidad";
import { guardarCapacidad } from "../actions";
import { Seccion } from "../taller/formulario";

type Mecanico = { id: string; nombre: string; color: string; especialidades: Especialidad[]; horasDia: number; dias: number[] };
const txt = (n: number | undefined) => (n ? String(n).replace(".", ",") : "");

export function FormCapacidad({ plazas, maxPorFranja, diasAbiertos, tipos, mecanicos }: { plazas: number | null; maxPorFranja: number | null; diasAbiertos: number[]; tipos: { id: string; nombre: string; horas: Horas }[]; mecanicos: Mecanico[] }) {
  const [dias, setDias] = useState(diasAbiertos);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pend, start] = useTransition();
  // Horas de un día normal (lunes): de cada especialidad, y las de quien hace varias (se reparten según haga falta)
  const lunes = mecanicos.filter((m) => m.dias.includes(1));
  const porEsp = ESPECIALIDADES.map((e) => ({ e, h: lunes.filter((m) => m.especialidades.length === 1 && m.especialidades[0] === e).reduce((s, m) => s + m.horasDia, 0) })).filter((x) => x.h > 0);
  const compartidas = lunes.filter((m) => m.especialidades.length > 1).reduce((s, m) => s + m.horasDia, 0);

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await guardarCapacidad(fd);
          setEstado(r.error ? { tipo: "error", texto: r.error } : { tipo: "ok", texto: "Cambios guardados" });
        })
      }
      onChange={() => estado?.tipo === "ok" && setEstado(null)}
    >
      <p className="text-sm text-slate-600">
        Con estos datos, la <b>Agenda</b> avisa cuando un día no se da abasto y propone otro con hueco. <b>Nunca bloquea</b>: siempre se puede meter un coche más.
      </p>

      <Seccion titulo="Taller" descripcion="Días que abre, coches que caben a la vez y cuántos se pueden recibir en cada franja (a primera hora, por la mañana…).">
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Días que abre</legend>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((d) => {
              const on = dias.includes(d.n);
              return (
                <label key={d.n} className={cx("inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-3 text-sm font-semibold", on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}>
                  <input type="checkbox" name="diasAbiertos" value={d.n} checked={on} onChange={() => setDias((v) => (on ? v.filter((x) => x !== d.n) : [...v, d.n]))} className="sr-only" />
                  {d.nombre}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Campo etiqueta="Plazas" ayuda="Coches que caben a la vez (campa, elevadores…). Vacío = no avisar.">
          <Input name="plazas" type="number" min={1} max={500} defaultValue={plazas ?? ""} className="max-w-32" />
        </Campo>
        <Campo etiqueta="Recepciones por franja" ayuda="Máximo de coches a recibir en cada franja. Vacío = no avisar.">
          <Input name="maxPorFranja" type="number" min={1} max={50} defaultValue={maxPorFranja ?? ""} className="max-w-32" />
        </Campo>
      </Seccion>

      <Tarjeta className="space-y-3 p-5">
        <div>
          <h2 className="font-semibold">Horas por tipo de trabajo</h2>
          <p className="mt-1 text-sm text-slate-500">Lo que suele ocupar cada tipo. Se propone al dar la cita (se puede cambiar en cada una) y se usa para los coches que aún no tienen mano de obra apuntada. Déjalo vacío si no se sabe hasta verlo (siniestros, averías): queda «por valorar» y cuenta plaza y recepción, pero no horas.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-2 font-medium">Tipo de trabajo</th>
                {ESPECIALIDADES.map((e) => <th key={e} className="px-1 py-1 font-medium">{NOMBRE_ESPECIALIDAD[e]}</th>)}
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 font-medium">
                    {t.nombre}
                    {!ESPECIALIDADES.some((e) => t.horas[e]) && <span className="block text-xs font-normal text-slate-500">Por valorar</span>}
                  </td>
                  {ESPECIALIDADES.map((e) => (
                    <td key={e} className="px-1 py-1.5">
                      <Input name={`h_${t.id}_${e}`} defaultValue={txt(t.horas[e])} inputMode="decimal" maxLength={5} placeholder="—" aria-label={`${t.nombre}: horas de ${NOMBRE_ESPECIALIDAD[e].toLowerCase()}`} className="w-20 tabular-nums" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <Tarjeta className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Mecánicos</h2>
          <Link href="/configuracion/empleados" className="text-sm font-semibold text-slate-700 underline">Cambiar en Empleados</Link>
        </div>
        <p className="text-sm text-slate-500">
          Cada mecánico cuenta con sus especialidades, sus horas de trabajo al día y los días que trabaja. Quien hace varias reparte sus horas a lo que más falte.
          {(porEsp.length > 0 || compartidas > 0) && (
            <> Un lunes: {[...porEsp.map((x) => `${NOMBRE_ESPECIALIDAD[x.e].toLowerCase()} ${fmtH(x.h)} h`), ...(compartidas ? [`${fmtH(compartidas)} h compartidas`] : [])].join(", ")}.</>
          )}
        </p>
        {mecanicos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay empleados con el puesto de mecánico.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mecanicos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="size-3 rounded-full" style={{ background: m.color }} aria-hidden />
                <span className="font-medium">{m.nombre}</span>
                <span className="text-slate-600">{nombreEspecialidades(m.especialidades)} · {fmtH(m.horasDia)} h/día · {DIAS_SEMANA.filter((d) => m.dias.includes(d.n)).map((d) => d.corto).join(" ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {estado && (
          <p role={estado.tipo === "error" ? "alert" : "status"} className={estado.tipo === "error" ? "text-sm text-red-700" : "flex items-center gap-1 text-sm text-emerald-700"}>
            {estado.tipo === "ok" && <Check className="size-4" aria-hidden />} {estado.texto}
          </p>
        )}
        <Boton type="submit" disabled={pend}>
          {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Guardar cambios
        </Boton>
      </div>
    </form>
  );
}
