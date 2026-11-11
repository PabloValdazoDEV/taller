import Link from "next/link";
import { AlertTriangle, CalendarClock, ShieldCheck } from "lucide-react";
import { Matricula, Pastilla, cx } from "./ui";
import { LogoMarca } from "./selector-marca-modelo";
import { fmtFecha } from "@/lib/formato";
import type { OTResumen } from "@/lib/data";

export function OtTarjeta({ ot, mostrarEstado = true, compacta = false }: { ot: OTResumen; mostrarEstado?: boolean; compacta?: boolean }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const retrasada = ot.fechaPrevista && ot.fechaPrevista < hoy && ot.estadoMarca !== "listo";
  return (
    <Link
      href={`/ot/${ot.id}`}
      className="block rounded-xl bg-white border border-slate-200 p-3 shadow-sm hover:border-primary hover:shadow transition"
      style={{ borderLeft: `4px solid ${ot.tipoColor}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <Matricula>{ot.matricula}</Matricula>
        <span className="text-xs text-slate-400 font-mono">{ot.numero}</span>
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
        {ot.incidenciasAbiertas > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="size-3.5" /> {ot.incidenciasAbiertas}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className={cx("inline-flex items-center gap-1", retrasada && "text-red-600 font-semibold")}>
          <CalendarClock className="size-3.5" /> {fmtFecha(ot.fechaPrevista)}
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
