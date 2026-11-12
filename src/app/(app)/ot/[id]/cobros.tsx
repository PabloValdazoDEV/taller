"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Banknote, Check, FileText, Loader2, Receipt, RefreshCw, Undo2, Wallet } from "lucide-react";
import { Boton, Campo, Input, Pastilla, Tarjeta, TituloSeccion, Vacio, cx } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import type { RepartoPago } from "@/db/schema";
import { fmtEuros } from "@/lib/importes";
import { fmtFechaHora } from "@/lib/formato";
import { METODOS_COBRO, NOMBRE_METODO, resumenCobro, type MetodoCobro } from "@/lib/cobros";
import { anularCobro, cambiarReparto, generarProforma, guardarFacturaExterna, registrarCobro } from "../cobros-actions";

export type ProformaVista = { id: string; numero: string; total: number; reparto: RepartoPago; facturaExterna: string | null; creadoEn: string; conformidadExceso: string | null };
export type CobroVista = { id: string; pagador: "cliente" | "compania"; metodo: MetodoCobro; importe: number; nota: string | null; fecha: string; usuario: string | null; anulado: boolean };

const aEuros = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Proforma («no es factura») y cobros de la orden. Se usa en la ficha de la OT y en la entrega. */
export function Cobros({ otId, proforma, cobros, totalActual, hayLineas, abierta, aceptado, titulo = "Proforma y cobros" }: {
  otId: string;
  proforma: ProformaVista | null;
  cobros: CobroVista[];
  totalActual: number;
  hayLineas: boolean;
  /** Orden sin entregar: se puede (re)hacer la proforma */
  abierta: boolean;
  /** Lo aceptado por el cliente: null si la orden no tiene presupuestos; total 0 si los tiene pero ninguno aceptado */
  aceptado: { numero: string | null; total: number } | null;
  titulo?: string;
}) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  const [cobrando, setCobrando] = useState<"cliente" | "compania" | null>(null);
  const [repartiendo, setRepartiendo] = useState(false);
  const [factura, setFactura] = useState(proforma?.facturaExterna ?? "");
  const [conformidad, setConformidad] = useState(false);
  // Se cobraría más de lo aceptado: hay que confirmar la conformidad del cliente
  const exceso = aceptado && totalActual > aceptado.total ? totalActual - aceptado.total : 0;
  const hacerProforma = () => (exceso ? setConformidad(true) : ejecutar(() => generarProforma(otId)));
  const r = proforma ? resumenCobro(proforma, cobros.map((c) => ({ ...c, anuladoEn: c.anulado ? "x" : null }))) : null;
  const desfasada = !!proforma && hayLineas && proforma.total !== totalActual;

  const ejecutar = (fn: () => Promise<{ error?: string }>, despues?: () => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (res.error) setError(res.error);
      else despues?.();
    });

  if (!proforma && !hayLineas)
    return (
      <Tarjeta className="p-4">
        <TituloSeccion><span className="inline-flex items-center gap-2"><Wallet className="size-4" aria-hidden /> {titulo}</span></TituloSeccion>
        <Vacio>Sin importes en la app: se cobra y factura con vuestro programa.</Vacio>
      </Tarjeta>
    );

  return (
    <Tarjeta className="p-4">
      <TituloSeccion
        accion={r && (r.estado === "cobrado" ? <Pastilla color="#047857">Cobrado</Pastilla> : <Pastilla color="#b45309">Pendiente {fmtEuros(r.pendiente)}</Pastilla>)}
      >
        <span className="inline-flex items-center gap-2"><Wallet className="size-4" aria-hidden /> {titulo}</span>
      </TituloSeccion>

      {abierta && hayLineas && exceso > 0 && (!proforma || desfasada || !proforma.conformidadExceso) && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {aceptado!.numero
              ? <>El total ({fmtEuros(totalActual)}) supera lo aceptado por el cliente en el presupuesto {aceptado!.numero} ({fmtEuros(aceptado!.total)}) en <b>{fmtEuros(exceso)}</b>.</>
              : <>El cliente no ha aceptado ningún presupuesto de esta orden.</>}{" "}
            Lo correcto es que acepte una ampliación; si ya está conforme, se te pedirá cómo.
          </span>
        </p>
      )}
      {!proforma ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">La proforma resume lo que se cobra (no es factura: la factura se hace en vuestro programa). Genérala cuando el trabajo esté terminado.</p>
          {abierta && (
            <Boton onClick={hacerProforma} disabled={pend}>
              {pend ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />} Generar proforma ({fmtEuros(totalActual)})
            </Boton>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-sm font-semibold">{proforma.numero}</span>
            <span className="text-lg font-bold tabular-nums">{fmtEuros(proforma.total)}</span>
            <span className="ml-auto flex flex-wrap gap-2">
              <a href={`/api/proformas/${proforma.id}`} target="_blank" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                <FileText className="size-4" aria-hidden /> Ver proforma
              </a>
              <a href={`/api/proformas/${proforma.id}?recibo=1`} target="_blank" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                <Receipt className="size-4" aria-hidden /> Recibo
              </a>
              {abierta && desfasada && (
                <Boton variante="secundario" className="min-h-10 px-3" onClick={hacerProforma} disabled={pend}>
                  <RefreshCw className="size-4" aria-hidden /> Actualizar
                </Boton>
              )}
            </span>
          </div>
          {desfasada && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Los importes han cambiado ({fmtEuros(proforma.total)} → {fmtEuros(totalActual)}).{abierta ? " Actualiza la proforma antes de cobrar." : ""}</span>
            </p>
          )}

          {proforma.conformidadExceso && (
            <p className="text-sm text-slate-600">Conformidad del cliente con el importe de más: <i>{proforma.conformidadExceso}</i></p>
          )}
          {r && (
            <div className={cx("grid gap-2", r.compania.nombre && "sm:grid-cols-2")}>
              <Parte titulo="Cliente" debe={r.cliente.debe} pagado={r.cliente.pagado} pendiente={r.cliente.pendiente} />
              {r.compania.nombre && <Parte titulo={r.compania.nombre} debe={r.compania.debe} pagado={r.compania.pagado} pendiente={r.compania.pendiente} />}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {r && r.cliente.pendiente > 0 && (
              <Boton variante="exito" onClick={() => setCobrando("cliente")} disabled={pend || desfasada}>
                <Banknote className="size-4" aria-hidden /> Cobrar al cliente {fmtEuros(r.cliente.pendiente)}
              </Boton>
            )}
            {r && r.compania.pendiente > 0 && (
              <Boton variante="secundario" onClick={() => setCobrando("compania")} disabled={pend || desfasada}>
                <Banknote className="size-4" aria-hidden /> Cobro de {r.compania.nombre}
              </Boton>
            )}
            {r?.compania.nombre && (
              <Boton variante="fantasma" onClick={() => setRepartiendo(true)} disabled={pend}>Cambiar reparto</Boton>
            )}
          </div>

          {cobros.length > 0 && (
            <ul className="divide-y divide-slate-100 border-y border-slate-100 text-sm">
              {cobros.map((c) => (
                <li key={c.id} className={cx("flex items-center gap-3 py-2", c.anulado && "text-slate-400 line-through")}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {NOMBRE_METODO[c.metodo]} · {c.pagador === "cliente" ? "cliente" : proforma.reparto.companiaNombre ?? "compañía"}
                    </div>
                    <div className="text-xs text-slate-500">{fmtFechaHora(c.fecha)}{c.usuario ? ` · ${c.usuario}` : ""}{c.nota ? ` · ${c.nota}` : ""}{c.anulado ? " · anulado" : ""}</div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{fmtEuros(c.importe)}</span>
                  {!c.anulado && (
                    <button
                      type="button"
                      onClick={() => confirm(`¿Anular el cobro de ${fmtEuros(c.importe)}?`) && ejecutar(() => anularCobro(otId, c.id))}
                      className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                      aria-label={`Anular cobro de ${fmtEuros(c.importe)}`}
                    >
                      <Undo2 className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ejecutar(() => guardarFacturaExterna(otId, factura));
            }}
          >
            <Campo etiqueta="Nº de factura en vuestro programa" className="min-w-48 flex-1">
              <Input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="Ej.: F-2026/0123" maxLength={40} />
            </Campo>
            <Boton type="submit" variante="secundario" disabled={pend || factura === (proforma.facturaExterna ?? "")}>Guardar</Boton>
          </form>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Dialogo abierto={!!cobrando} onCerrar={() => setCobrando(null)} titulo={cobrando === "compania" ? `Cobro de ${r?.compania.nombre ?? "la compañía"}` : "Cobrar al cliente"}>
        {cobrando && r && (
          <FormCobro otId={otId} pagador={cobrando} pendiente={cobrando === "cliente" ? r.cliente.pendiente : r.compania.pendiente} onHecho={() => setCobrando(null)} />
        )}
      </Dialogo>
      <Dialogo
        abierto={conformidad}
        onCerrar={() => setConformidad(false)}
        titulo="¿El cliente está conforme?"
        descripcion={`Se va a cobrar ${fmtEuros(exceso)} más de lo que aceptó${aceptado?.numero ? ` (${aceptado.numero}: ${fmtEuros(aceptado.total)})` : ""}. Queda anotado en la proforma y en el registro.`}
      >
        {conformidad && (
          <FormConformidad
            onEnviar={(nota) => generarProforma(otId, undefined, nota)}
            onHecho={() => setConformidad(false)}
          />
        )}
      </Dialogo>
      <Dialogo abierto={repartiendo} onCerrar={() => setRepartiendo(false)} titulo="¿Quién paga qué?" descripcion={`Total ${proforma ? fmtEuros(proforma.total) : ""}. Lo que no pague el cliente lo paga ${r?.compania.nombre ?? "la compañía"}.`}>
        {repartiendo && proforma && (
          <FormReparto otId={otId} total={proforma.total} cliente={proforma.reparto.cliente} compania={proforma.reparto.companiaNombre ?? "la compañía"} onHecho={() => setRepartiendo(false)} />
        )}
      </Dialogo>
    </Tarjeta>
  );
}

function Parte({ titulo, debe, pagado, pendiente }: { titulo: string; debe: number; pagado: number; pendiente: number }) {
  return (
    <div className={cx("rounded-xl border p-3 text-sm", pendiente > 0 ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{titulo}</span>
        <span className="font-semibold tabular-nums">{fmtEuros(debe)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-slate-600">
        <span>{pendiente > 0 ? `Pendiente ${fmtEuros(pendiente)}` : debe > 0 ? "Pagado" : "Nada que pagar"}</span>
        {pendiente === 0 && debe > 0 && <Check className="size-4 text-emerald-600" aria-hidden />}
        {pagado > 0 && pendiente > 0 && <span>Pagado {fmtEuros(pagado)}</span>}
      </div>
    </div>
  );
}

function FormCobro({ otId, pagador, pendiente, onHecho }: { otId: string; pagador: "cliente" | "compania"; pendiente: number; onHecho: () => void }) {
  const [metodo, setMetodo] = useState<MetodoCobro>(pagador === "compania" ? "transferencia" : "tarjeta");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          setError("");
          const r = await registrarCobro(fd);
          if (r.error) setError(r.error);
          else onHecho();
        })
      }
    >
      <input type="hidden" name="otId" value={otId} />
      <input type="hidden" name="pagador" value={pagador} />
      <input type="hidden" name="metodo" value={metodo} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Cómo paga</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METODOS_COBRO.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metodo === m}
              onClick={() => setMetodo(m)}
              className={cx("min-h-11 rounded-xl border-2 px-2 text-sm font-semibold", metodo === m ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}
            >
              {NOMBRE_METODO[m]}
            </button>
          ))}
        </div>
      </fieldset>
      <Campo etiqueta="Importe (€)" ayuda={`Pendiente: ${fmtEuros(pendiente)}. Puede ser un pago parcial.`}>
        <Input name="importe" inputMode="decimal" defaultValue={aEuros(pendiente)} required className="max-w-40 text-lg font-semibold tabular-nums" />
      </Campo>
      <Campo etiqueta="Nota (opcional)"><Input name="nota" maxLength={200} placeholder={pagador === "compania" ? "Ej.: Transferencia del 15/11" : "Ej.: Paga el resto al recoger"} /></Campo>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" variante="exito" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Registrar cobro</Boton>
      </div>
    </form>
  );
}

function FormReparto({ otId, total, cliente, compania, onHecho }: { otId: string; total: number; cliente: number; compania: string; onHecho: () => void }) {
  const [valor, setValor] = useState(aEuros(cliente));
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const c = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const r = await cambiarReparto(otId, valor);
          if (r.error) setError(r.error);
          else onHecho();
        });
      }}
    >
      <Campo etiqueta="Paga el cliente (€)" ayuda="Normalmente, la franquicia.">
        <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="max-w-40 text-lg font-semibold tabular-nums" />
      </Campo>
      <p className="text-sm text-slate-600">Paga {compania}: <b className="tabular-nums">{Number.isFinite(c) && c >= 0 && c <= total ? fmtEuros(total - c) : "—"}</b></p>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Guardar</Boton>
      </div>
    </form>
  );
}

function FormConformidad({ onEnviar, onHecho }: { onEnviar: (nota: string) => Promise<{ error?: string }>; onHecho: () => void }) {
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const r = await onEnviar(nota);
          if (r.error) setError(r.error);
          else onHecho();
        });
      }}
    >
      <Campo etiqueta="Cómo ha dado su conformidad">
        <Input value={nota} onChange={(e) => setNota(e.target.value)} required minLength={3} maxLength={300} placeholder="Ej.: Lo aprobó por teléfono el 12/11 a las 10:30 (habló con Ana)" autoFocus />
      </Campo>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Está conforme: hacer la proforma</Boton>
      </div>
    </form>
  );
}
