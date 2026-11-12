import Link from "next/link";
import { AlertTriangle, CalendarClock, ShieldCheck } from "lucide-react";
import { Matricula, Pastilla, cx } from "./ui";
import { LogoMarca } from "./selector-marca-modelo";
import { diasDesde, fmtFecha } from "@/lib/formato";
import { esRetrasada } from "@/lib/ots";
import type { OTResumen } from "@/lib/data";

export function OtTarjeta({ ot, mostrarEstado = true, compacta = false }: { ot: OTResumen; mostrarEstado?: boolean; compacta?: boolean }) {
  const retrasada = esRetrasada(ot);
  const dias = diasDesde(ot.fechaEntrada);
  return (
    <Link
      href={`/ot/${ot.id}`}
      className="block rounded-xl bg-white border border-slate-200 p-3 shadow-sm hover:border-primary hover:shadow transition"
      style={{ borderLeft: `4px solid ${ot.tipoColor}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 whitespace-nowrap"><Matricula>{ot.matricula}</Matricula></span>
        <span className="flex items-center gap-2 min-w-0 whitespace-nowrap">
          <span
            className={cx("shrink-0 text-[11px] font-semibold rounded-full px-1.5", dias >= 10 ? "bg-red-50 text-red-700" : dias >= 5 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}
            title={`Lleva ${dias} día(s) en el taller`}
          >
            {dias === 0 ? "hoy" : `${dias} d`}
          </span>
          <span className="text-xs text-slate-400 font-mono truncate">{ot.numero}</span>
        </span>
      </div>
      <div className="mt-1.5 font-semibold text-sm truncate flex items-center gap-1.5">
        {ot.marca && <LogoMarca marca={ot.marca} className="size-5 shrink-0" />}
        <span className="truncate">{ot.marca} {ot.modelo}</span>
      </div>
      {!compacta && <div className="text-xs text-slate-500 line-clamp-2">{ot.trabajo}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {mostrarEstado && <Pastilla color={ot.tipoColor}>{ot.estadoNombre}</Pastilla>}
        {ot.datosSiniestro?.companiaNombre && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
            <ShieldCheck className="size-3.5" /> {ot.datosSiniestro.companiaNombre}
          </span>
        )}
        {ot.averiasPendientes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[11px] font-semibold" title="Avería adicional pendiente de que el cliente la apruebe">
            Aprobación extra
          </span>
        )}
        {ot.ampliacionPendiente && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-semibold" title="Ampliación de presupuesto sin aceptar: se sigue con lo aprobado, lo nuevo espera">
            <span aria-hidden className="text-sm leading-none">*</span> Ampliación pendiente
          </span>
        )}
        {ot.incidenciasAbiertas > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="size-3.5" /> {ot.incidenciasAbiertas}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className={cx("inline-flex items-center gap-1", retrasada && "text-red-600 font-semibold")}>
          <CalendarClock className="size-3.5" /> {retrasada && "Retrasado · "}{fmtFecha(ot.fechaPrevista)}
        </span>
        {ot.mecanicoNombre ? (
          <span className="inline-flex items-center gap-1">
            <span className="size-4 rounded-full grid place-items-center text-[9px] text-white font-bold" style={{ background: ot.mecanicoColor ?? "#64748b" }}>
              {ot.mecanicoNombre[0]}
            </span>
            {ot.mecanicoNombre.split(" ")[0]}
          </span>
        ) : (
          <span className="italic">Sin asignar</span>
        )}
      </div>
    </Link>
  );
}
