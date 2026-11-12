import type { LineaPresupuesto } from "@/db/schema";
import { NOMBRE_ESPECIALIDAD, fmtCantidad, fmtEuros, fmtPrecio, type Especialidad } from "@/lib/importes";
import { fmtFecha } from "@/lib/formato";
import { cx } from "./ui";

type P = {
  numero: string;
  tipo: "inicial" | "complementario";
  lineas: LineaPresupuesto[];
  ivaModo: "con_iva" | "exento";
  ivaPct: string;
  motivoExencion: string | null;
  preciosConIva: boolean;
  base: number;
  iva: number;
  total: number;
  validezHasta: string;
  creadoEn: Date;
};

/** Presupuesto tal y como lo ve el cliente (tablet del taller o su móvil). Sin tabla: se lee bien en cualquier ancho. */
export function VistaPresupuesto({ p, className }: { p: P; className?: string }) {
  return (
    <div className={cx("space-y-4", className)}>
      <ul className="divide-y divide-slate-100 border-y border-slate-200">
        {p.lineas.map((l, i) => {
          const n = Number(l.cantidad);
          const detalle = [
            l.tipo === "mano_obra" && l.especialidad ? `Mano de obra · ${NOMBRE_ESPECIALIDAD[l.especialidad as Especialidad] ?? l.especialidad}` : null,
            l.referencia ? `Ref. ${l.referencia}` : null,
            `${fmtCantidad(n)}${l.tipo === "mano_obra" ? " h" : l.tipo === "pieza" ? (n === 1 ? " ud." : " uds.") : ""} × ${fmtPrecio(l.precio)}`,
            Number(l.descuento) > 0 ? `−${fmtCantidad(l.descuento)} %` : null,
          ].filter(Boolean);
          return (
            <li key={i} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium">{l.descripcion}</div>
                <div className="text-sm text-slate-500">{detalle.join(" · ")}</div>
              </div>
              <div className="shrink-0 font-semibold tabular-nums">{fmtEuros(l.importe)}</div>
            </li>
          );
        })}
      </ul>

      <dl className="ml-auto max-w-sm space-y-1">
        {p.ivaModo === "con_iva" ? (
          <>
            <div className="flex justify-between gap-4 text-slate-600"><dt>Base imponible</dt><dd className="tabular-nums">{fmtEuros(p.base)}</dd></div>
            <div className="flex justify-between gap-4 text-slate-600"><dt>IVA ({fmtCantidad(p.ivaPct)} %)</dt><dd className="tabular-nums">{fmtEuros(p.iva)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 text-xl font-bold"><dt>Total</dt><dd className="tabular-nums">{fmtEuros(p.total)}</dd></div>
            {p.preciosConIva && <p className="text-right text-xs text-slate-500">Precios con IVA incluido</p>}
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 text-xl font-bold"><dt>Total (exento de IVA)</dt><dd className="tabular-nums">{fmtEuros(p.total)}</dd></div>
            <p className="text-right text-xs text-slate-500">Operación exenta de IVA{p.motivoExencion ? `: ${p.motivoExencion}` : ""}</p>
          </>
        )}
      </dl>
      <p className="text-sm text-slate-500">
        Presupuesto {p.tipo === "complementario" ? "complementario " : ""}nº {p.numero}, emitido el {fmtFecha(p.creadoEn)} y válido hasta el <b className="text-slate-700">{fmtFecha(p.validezHasta)}</b>.
      </p>
    </div>
  );
}
