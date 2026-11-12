"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2, Package, Pencil, Plus, ReceiptText, Trash2, Wrench } from "lucide-react";
import { Boton, Campo, Input, Select, Tarjeta, TituloSeccion, Vacio, cx } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import {
  ESPECIALIDADES, NOMBRE_ESPECIALIDAD, NOMBRE_TIPO_LINEA, convertirPrecio, fmtCantidad, fmtEuros, fmtPrecio, importeLinea, leerDecimal, totales,
  type Especialidad, type ModoIva, type TipoLinea,
} from "@/lib/importes";
import { borrarLinea, cambiarPreciosConIva, configurarIva, guardarLinea } from "../importes-actions";

export type LineaVista = {
  id: string;
  tipo: TipoLinea;
  especialidad: string | null;
  referencia: string | null;
  descripcion: string;
  cantidad: string;
  precio: string;
  descuento: string;
};

type Props = {
  otId: string;
  lineas: LineaVista[];
  modo: ModoIva;
  pct: string;
  motivo: string;
  preciosConIva: boolean;
  /** €/hora SIN IVA por especialidad (Configuración › Datos del taller) */
  tarifas: Partial<Record<Especialidad, number>>;
  editable: boolean;
};

const UNIDAD: Record<TipoLinea, (n: number) => string> = {
  mano_obra: () => "h",
  pieza: (n) => (n === 1 ? "ud." : "uds."),
  otro: () => "",
};

/** Importe de la orden: líneas de mano de obra, piezas y otros conceptos, con IVA o exento. */
export function Importes({ otId, lineas, modo, pct, motivo, preciosConIva, tarifas, editable }: Props) {
  const [editando, setEditando] = useState<LineaVista | { nueva: TipoLinea } | null>(null);
  const [dialogoExento, setDialogoExento] = useState(false);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const t = totales(lineas, modo, pct, preciosConIva);
  const pctTxt = fmtCantidad(pct);
  const sufijo = modo === "exento" ? "" : preciosConIva ? " (IVA incluido)" : " (sin IVA)";

  const ejecutar = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <Tarjeta className="p-4">
      <TituloSeccion accion={lineas.length > 0 && <span className="text-lg font-bold tabular-nums">{fmtEuros(t.total)}</span>}>
        <span className="inline-flex items-center gap-2"><ReceiptText className="size-4" aria-hidden /> Importe</span>
      </TituloSeccion>

      {editable && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Segmentado
            etiqueta="IVA del trabajo"
            valor={modo}
            deshabilitado={pend}
            opciones={[
              { valor: "con_iva", texto: `Con IVA (${pctTxt} %)` },
              { valor: "exento", texto: "Exento" },
            ]}
            onCambio={(v) => (v === "exento" ? setDialogoExento(true) : ejecutar(() => configurarIva(otId, "con_iva")))}
          />
          {modo === "con_iva" ? (
            <Segmentado
              etiqueta="Los precios se escriben"
              valor={preciosConIva ? "con" : "sin"}
              deshabilitado={pend}
              opciones={[
                { valor: "sin", texto: "Sin IVA" },
                { valor: "con", texto: "IVA incluido" },
              ]}
              onCambio={(v) => {
                if (lineas.length && !confirm(`Se convertirán los precios de ${lineas.length === 1 ? "la línea" : `las ${lineas.length} líneas`} para que el importe no cambie. ¿Seguir?`)) return;
                ejecutar(() => cambiarPreciosConIva(otId, v === "con"));
              }}
            />
          ) : (
            <div className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Motivo de la exención</span>
              <span className="text-slate-800">{motivo || "—"}</span>{" "}
              <button type="button" className="font-semibold text-slate-700 underline" onClick={() => setDialogoExento(true)}>Cambiar</button>
            </div>
          )}
        </div>
      )}

      {lineas.length === 0 ? (
        <Vacio>{editable ? "Aún no hay importes. Añade la mano de obra y las piezas." : "Sin importes."}</Vacio>
      ) : (
        <ul className="divide-y divide-slate-100 border-y border-slate-100">
          {lineas.map((l) => {
            const n = Number(l.cantidad);
            const desc = Number(l.descuento);
            return (
              <li key={l.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-hidden>
                  {l.tipo === "mano_obra" ? <Wrench className="size-4" /> : l.tipo === "pieza" ? <Package className="size-4" /> : <ReceiptText className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{l.descripcion}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{fmtEuros(importeLinea(l))}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {[
                        l.tipo === "mano_obra" && l.especialidad ? NOMBRE_ESPECIALIDAD[l.especialidad as Especialidad] : NOMBRE_TIPO_LINEA[l.tipo],
                        l.referencia && `Ref. ${l.referencia}`,
                        `${fmtCantidad(n)}${l.tipo === "otro" ? "" : ` ${UNIDAD[l.tipo](n)}`} × ${fmtPrecio(l.precio)}${l.tipo === "mano_obra" ? "/h" : ""}`,
                        desc > 0 && `−${fmtCantidad(desc)} %`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {editable && (
                      <span className="-mr-2 flex shrink-0">
                        <button type="button" onClick={() => setEditando(l)} className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Editar ${l.descripcion}`}>
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          disabled={pend}
                          onClick={() => confirm(`¿Quitar «${l.descripcion}»?`) && ejecutar(() => borrarLinea(otId, l.id))}
                          className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Quitar ${l.descripcion}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <div className="mt-3 grid grid-cols-3 gap-2 [overflow-wrap:normal]">
          {(["mano_obra", "pieza", "otro"] as const).map((tp) => (
            <Boton key={tp} variante="secundario" className="flex-col gap-0.5 px-2 py-1.5 leading-tight sm:flex-row sm:gap-2" aria-label={`Añadir ${NOMBRE_TIPO_LINEA[tp].toLowerCase()}`} onClick={() => setEditando({ nueva: tp })}>
              <Plus className="size-4 shrink-0" aria-hidden />
              {tp === "otro" ? <><span className="sm:hidden">Otro</span><span className="hidden sm:inline">Otro concepto</span></> : NOMBRE_TIPO_LINEA[tp]}
            </Boton>
          ))}
        </div>
      )}

      {lineas.length > 0 && (
        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          {modo === "con_iva" ? (
            <>
              <Fila t="Base imponible" v={fmtEuros(t.base)} />
              <Fila t={`IVA (${pctTxt} %)`} v={fmtEuros(t.iva)} />
              <Fila t="Total" v={fmtEuros(t.total)} fuerte />
              {preciosConIva && <p className="pt-1 text-right text-xs text-slate-500">Precios con IVA incluido</p>}
            </>
          ) : (
            <>
              <Fila t="Total (exento de IVA)" v={fmtEuros(t.total)} fuerte />
              <p className="pt-1 text-right text-xs text-slate-500">Operación exenta de IVA{motivo ? `: ${motivo}` : ""}</p>
            </>
          )}
        </dl>
      )}

      {pend && <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" aria-hidden /> Guardando…</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Dialogo
        abierto={!!editando}
        onCerrar={() => setEditando(null)}
        titulo={editando && "nueva" in editando ? `Añadir ${NOMBRE_TIPO_LINEA[editando.nueva].toLowerCase()}` : "Editar línea"}
        descripcion={modo === "exento" ? "Trabajo exento: el precio es el importe final." : preciosConIva ? "Precios con IVA incluido." : "Precios sin IVA (el IVA se suma en el total)."}
      >
        {editando && (
          <FormLinea
            otId={otId}
            linea={"nueva" in editando ? null : editando}
            tipoNuevo={"nueva" in editando ? editando.nueva : editando.tipo}
            tarifa={(e) => {
              const base = tarifas[e];
              if (base == null) return "";
              const p = modo === "con_iva" && preciosConIva ? convertirPrecio(base, pct, true) : base;
              return fmtCantidad(Math.round(p * 100) / 100);
            }}
            sufijo={sufijo}
            onHecho={() => setEditando(null)}
          />
        )}
      </Dialogo>

      <Dialogo abierto={dialogoExento} onCerrar={() => setDialogoExento(false)} titulo="Trabajo exento de IVA" descripcion="El motivo legal sale en el presupuesto y en la proforma.">
        {dialogoExento && (
          <FormExento
            motivo={motivo}
            onGuardar={(m) =>
              start(async () => {
                setError("");
                const r = await configurarIva(otId, "exento", m);
                if (r.error) setError(r.error);
                else setDialogoExento(false);
              })
            }
            pendiente={pend}
            error={error}
          />
        )}
      </Dialogo>
    </Tarjeta>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-4", fuerte && "border-t border-slate-200 pt-1 text-base font-bold")}>
      <dt className={fuerte ? "" : "text-slate-500"}>{t}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

function Segmentado<T extends string>({ etiqueta, valor, opciones, onCambio, deshabilitado }: { etiqueta: string; valor: T; opciones: { valor: T; texto: string }[]; onCambio: (v: T) => void; deshabilitado?: boolean }) {
  return (
    <div role="group" aria-label={etiqueta}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</span>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={valor === o.valor}
            disabled={deshabilitado}
            onClick={() => valor !== o.valor && onCambio(o.valor)}
            className={cx("min-h-10 rounded-lg px-2 text-sm font-semibold transition", valor === o.valor ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormExento({ motivo, onGuardar, pendiente, error }: { motivo: string; onGuardar: (m: string) => void; pendiente: boolean; error: string }) {
  const [m, setM] = useState(motivo);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(m);
      }}
    >
      <Campo etiqueta="Motivo legal de la exención" ayuda="Obligatorio: si no se cobra IVA, el documento tiene que decir por qué (lo exige la ley). La frase exacta os la da la gestoría. Si un cliente está siempre exento, ponlo en su ficha y saldrá solo.">
        <Input value={m} onChange={(e) => setM(e.target.value)} required minLength={5} autoFocus />
      </Campo>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente || m.trim().length < 5}>{pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />} Marcar como exento</Boton>
      </div>
    </form>
  );
}

function FormLinea({ otId, linea, tipoNuevo, tarifa, sufijo, onHecho }: {
  otId: string;
  linea: LineaVista | null;
  tipoNuevo: TipoLinea;
  tarifa: (e: Especialidad) => string;
  sufijo: string;
  onHecho: () => void;
}) {
  const tipo = linea?.tipo ?? tipoNuevo;
  const esp0 = (linea?.especialidad as Especialidad | null) ?? "mecanica";
  const descDefecto = (e: Especialidad) => `Mano de obra ${NOMBRE_ESPECIALIDAD[e].toLowerCase()}`;
  const [especialidad, setEspecialidad] = useState<Especialidad>(esp0);
  const [descripcion, setDescripcion] = useState(linea?.descripcion ?? (tipo === "mano_obra" ? descDefecto(esp0) : ""));
  const [cantidad, setCantidad] = useState(linea ? fmtCantidad(linea.cantidad) : tipo === "mano_obra" ? "" : "1");
  const [precio, setPrecio] = useState(linea ? fmtPrecio(linea.precio).replace(/\s?€/, "").replace(/\./g, "") : tipo === "mano_obra" ? tarifa(esp0) : "");
  const [descuento, setDescuento] = useState(linea && Number(linea.descuento) > 0 ? fmtCantidad(linea.descuento) : "");
  const [verDescuento, setVerDescuento] = useState(!!descuento);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  const q = leerDecimal(cantidad);
  const p = leerDecimal(precio);
  const d = descuento ? leerDecimal(descuento) : 0;
  const valido = Number.isFinite(q) && Number.isFinite(p) && Number.isFinite(d);

  function cambiarEspecialidad(e: Especialidad) {
    // Si el precio y la descripción eran los de la especialidad anterior, se actualizan con los de la nueva
    if (!precio || precio === tarifa(especialidad)) setPrecio(tarifa(e));
    if (!descripcion || descripcion === descDefecto(especialidad)) setDescripcion(descDefecto(e));
    setEspecialidad(e);
  }

  const etiquetas: Record<TipoLinea, { cant: string; precio: string; ph: string }> = {
    mano_obra: { cant: "Horas", precio: "Precio/hora", ph: "Ej.: 1,5" },
    pieza: { cant: "Unidades", precio: "Precio/ud.", ph: "1" },
    otro: { cant: "Cantidad", precio: "Importe", ph: "1" },
  };
  const e = etiquetas[tipo];

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          setError("");
          const r = await guardarLinea(fd);
          if (r.error) setError(r.error);
          else onHecho();
        })
      }
    >
      <input type="hidden" name="otId" value={otId} />
      <input type="hidden" name="tipo" value={tipo} />
      {linea && <input type="hidden" name="id" value={linea.id} />}

      {tipo === "mano_obra" && (
        <Campo etiqueta="Especialidad">
          <Select name="especialidad" value={especialidad} onChange={(ev) => cambiarEspecialidad(ev.target.value as Especialidad)}>
            {ESPECIALIDADES.map((x) => <option key={x} value={x}>{NOMBRE_ESPECIALIDAD[x]}{tarifa(x) ? ` · ${tarifa(x)} €/h` : ""}</option>)}
          </Select>
        </Campo>
      )}
      <Campo etiqueta={tipo === "pieza" ? "Pieza" : "Descripción"}>
        <Input name="descripcion" value={descripcion} onChange={(ev) => setDescripcion(ev.target.value)} required minLength={2} maxLength={200} placeholder={tipo === "pieza" ? "Ej.: Pastillas de freno delanteras" : tipo === "otro" ? "Ej.: Gestión de residuos" : ""} autoFocus={tipo !== "mano_obra"} />
      </Campo>
      {tipo === "pieza" && (
        <Campo etiqueta="Referencia (opcional)"><Input name="referencia" defaultValue={linea?.referencia ?? ""} maxLength={60} /></Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={e.cant}>
          <Input name="cantidad" inputMode="decimal" value={cantidad} onChange={(ev) => setCantidad(ev.target.value)} required placeholder={e.ph} autoFocus={tipo === "mano_obra"} />
        </Campo>
        <Campo etiqueta={`${e.precio}${sufijo}`}>
          <Input name="precio" inputMode="decimal" value={precio} onChange={(ev) => setPrecio(ev.target.value)} required placeholder="0,00" />
        </Campo>
      </div>
      {tipo === "otro" && <p className="-mt-2 text-xs text-slate-500">Para un descuento general, pon el importe en negativo (ej.: −20).</p>}

      {tipo !== "otro" &&
        (verDescuento ? (
          <Campo etiqueta="Descuento (%)"><Input name="descuento" inputMode="decimal" value={descuento} onChange={(ev) => setDescuento(ev.target.value)} placeholder="Ej.: 10" className="max-w-32" /></Campo>
        ) : (
          <button type="button" className="text-sm font-semibold text-slate-700 underline" onClick={() => setVerDescuento(true)}>Añadir descuento</button>
        ))}

      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-600">Importe de la línea{sufijo}</span>
        <span className="text-base font-bold tabular-nums">{valido ? fmtEuros(importeLinea({ cantidad: q, precio: p, descuento: d })) : "—"}</span>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend || !valido}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} {linea ? "Guardar" : "Añadir"}</Boton>
      </div>
    </form>
  );
}

/** Para quien no ve importes (mecánicos): qué hay que hacer, sin precios. */
export function TrabajoPrevisto({ lineas: todas }: { lineas: LineaVista[] }): ReactNode {
  // Los «otros conceptos» (tasas, residuos, descuentos…) no son trabajo del taller
  const lineas = todas.filter((l) => l.tipo !== "otro");
  if (!lineas.length) return null;
  return (
    <Tarjeta className="p-4">
      <TituloSeccion><span className="inline-flex items-center gap-2"><Wrench className="size-4" aria-hidden /> Trabajo previsto</span></TituloSeccion>
      <ul className="divide-y divide-slate-100 text-sm">
        {lineas.map((l) => {
          const n = Number(l.cantidad);
          return (
            <li key={l.id} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                {l.descripcion}
                {l.referencia && <span className="text-slate-500"> · Ref. {l.referencia}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">{fmtCantidad(n)} {UNIDAD[l.tipo](n)}</span>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
