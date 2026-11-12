import type { LineaPresupuesto } from "@/db/schema";
import { NOMBRE_ESPECIALIDAD, fmtCantidad, fmtEuros, fmtPrecio, type Especialidad } from "@/lib/importes";
import { fmtFecha } from "@/lib/formato";
import { fmtHoras, type Cambio } from "@/lib/ampliacion";
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
  horasEstimadas?: string | null;
  fechaEntrega?: string | null;
};

type Ampliacion = { numero: string; total: number; cambios: Cambio[] };
const ETQ = { nueva: "Nuevo", cambia: "Cambia", quita: "Se quita" } as const;

/** Presupuesto tal y como lo ve el cliente (tablet del taller o su móvil). Sin tabla: se lee bien en cualquier ancho. */
export function VistaPresupuesto({ p, ampliacion, className }: { p: P; ampliacion?: Ampliacion | null; className?: string }) {
  const horas = fmtHoras(p.horasEstimadas);
  const lista = (
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
  );
  return (
    <div className={cx("space-y-4", className)}>
      {ampliacion && <BloqueAmpliacion a={ampliacion} total={p.total} ivaPct={p.ivaModo === "con_iva" && !p.preciosConIva ? p.ivaPct : null} />}
      {ampliacion ? (
        <details className="group rounded-xl border border-slate-200 px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-700">Ver el detalle completo ({p.lineas.length} líneas)</summary>
          <div className="pb-3">{lista}</div>
        </details>
      ) : (
        lista
      )}

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
      {(horas || p.fechaEntrega) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          {horas && <span>{ampliacion ? "Tiempo de más" : "Tiempo de trabajo estimado"}: <b>{horas}</b></span>}
          {p.fechaEntrega && <span>{ampliacion ? "Nueva fecha de entrega" : "Entrega prevista"}: <b>{fmtFecha(p.fechaEntrega)}</b></span>}
        </div>
      )}
      <p className="text-sm text-slate-500">
        {p.tipo === "complementario" ? "Ampliación de presupuesto" : "Presupuesto"} nº {p.numero}, emitido el {fmtFecha(p.creadoEn)} y válido hasta el <b className="text-slate-700">{fmtFecha(p.validezHasta)}</b>.
      </p>
    </div>
  );
}

/** Lo que añade o cambia la ampliación y cuánto sube (o baja) respecto a lo ya aceptado. */
function BloqueAmpliacion({ a, total, ivaPct }: { a: Ampliacion; total: number; ivaPct: string | null }) {
  const dif = total - a.total;
  const difLinea = (c: Cambio) => (c.tipo === "nueva" ? c.linea.importe : c.tipo === "quita" ? -c.linea.importe : c.linea.importe - (c.antes?.importe ?? 0));
  // Precios sin IVA: las líneas van sin IVA y el IVA de la diferencia se muestra aparte para que cuadre
  const ivaDif = ivaPct ? dif - a.cambios.reduce((s, c) => s + difLinea(c), 0) : 0;
  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 p-3">
      <p className="font-semibold">Además de lo que ya aceptó (presupuesto {a.numero}), hace falta:</p>
      <ul className="mt-2 space-y-2">
        {a.cambios.map((c, i) => {
          const d = difLinea(c);
          return (
            <li key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={cx("mr-2 rounded-md px-1.5 py-0.5 text-xs font-bold", c.tipo === "quita" ? "bg-slate-200 text-slate-700" : "bg-amber-200 text-amber-900")}>{ETQ[c.tipo]}</span>
                <span className={cx("font-medium", c.tipo === "quita" && "line-through")}>{c.linea.descripcion}</span>
                {c.tipo === "cambia" && c.antes && (
                  <div className="text-sm text-slate-500">
                    Antes {fmtCantidad(c.antes.cantidad)}{c.antes.tipo === "mano_obra" ? " h" : ""}, ahora {fmtCantidad(c.linea.cantidad)}{c.linea.tipo === "mano_obra" ? " h" : ""}
                  </div>
                )}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{d >= 0 ? "+" : "−"}{fmtEuros(Math.abs(d))}</span>
            </li>
          );
        })}
        {ivaPct && ivaDif !== 0 && (
          <li className="flex items-start justify-between gap-3 text-slate-600">
            <span>IVA ({fmtCantidad(ivaPct)} %)</span>
            <span className="shrink-0 tabular-nums">{ivaDif >= 0 ? "+" : "−"}{fmtEuros(Math.abs(ivaDif))}</span>
          </li>
        )}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-amber-200 pt-2 text-sm">
        <div className="flex justify-between gap-4 text-slate-600"><dt>Ya aceptado ({a.numero})</dt><dd className="tabular-nums">{fmtEuros(a.total)}</dd></div>
        <div className="flex justify-between gap-4 text-base font-bold"><dt>Ampliación</dt><dd className="tabular-nums">{dif >= 0 ? "+" : "−"}{fmtEuros(Math.abs(dif))}</dd></div>
        <div className="flex justify-between gap-4 text-slate-600"><dt>Nuevo total</dt><dd className="tabular-nums">{fmtEuros(total)}</dd></div>
      </dl>
    </div>
  );
}
