"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, FileSignature, FileText, Loader2, MessageCircle, Plus, Tablet, Trash2, X } from "lucide-react";
import { Boton, Campo, Input, Pastilla, Tarjeta, TituloSeccion, Vacio, cx } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import { fmtEuros } from "@/lib/importes";
import { diaISO, fmtFecha } from "@/lib/formato";
import { fmtHoras } from "@/lib/ampliacion";
import { aprobarSinFirma, borrarPresupuesto, crearPresupuesto, rechazarPresupuesto } from "../presupuestos-actions";

export type PresupuestoVista = {
  id: string;
  numero: string;
  tipo: "inicial" | "complementario";
  estado: "pendiente" | "aprobado" | "rechazado" | "sustituido";
  total: number;
  creadoEn: string;
  validezHasta: string;
  caducado: boolean;
  decididoEn: string | null;
  decididoVia: "tablet" | "enlace" | "manual" | null;
  decididoNombre: string | null;
  decisionNota: string | null;
  firmado: boolean;
  horasEstimadas: string | null;
  fechaEntrega: string | null;
  /** Ampliación: el presupuesto aceptado al que amplía */
  amplia: { numero: string; total: number } | null;
  /** Solo si está pendiente y vigente */
  enlace: string | null;
  whatsapp: string | null;
};

const ESTADO: Record<PresupuestoVista["estado"], { t: string; c: string }> = {
  pendiente: { t: "Pendiente de aceptar", c: "#b45309" },
  aprobado: { t: "Aceptado", c: "#047857" },
  rechazado: { t: "No aceptado", c: "#b91c1c" },
  sustituido: { t: "Sustituido", c: "#64748b" },
};
const VIA = { tablet: "firmado en el taller", enlace: "por enlace en su móvil", manual: "sin firma" } as const;

export function Presupuestos({ otId, presupuestos, hayLineas, totalActual, editable, cliente, horasSugeridas, fechaPrevista, averiaPendiente }: {
  otId: string;
  presupuestos: PresupuestoVista[];
  hayLineas: boolean;
  totalActual: number;
  editable: boolean;
  cliente: string;
  /** Horas de mano de obra (o, si ya hay uno aceptado, las de más) para proponer en el nuevo */
  horasSugeridas: number;
  fechaPrevista: string | null;
  /** Hay una avería adicional abierta que afecta al precio */
  averiaPendiente: boolean;
}) {
  const [pend, start] = useTransition();
  const [error, setError] = useState("");
  const [dialogo, setDialogo] = useState<{ tipo: "aprobar" | "rechazar"; p: PresupuestoVista } | null>(null);
  const [creando, setCreando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const pendiente = presupuestos.find((p) => p.estado === "pendiente");
  const ultimoAprobado = presupuestos.find((p) => p.estado === "aprobado");
  const cambiado = ultimoAprobado && hayLineas && ultimoAprobado.total !== totalActual && !pendiente;

  const borrar = (p: PresupuestoVista) => {
    if (!confirm(`¿Borrar el presupuesto ${p.numero}? Si se lo habéis enviado, su enlace dejará de funcionar.`)) return;
    start(async () => {
      setError("");
      const r = await borrarPresupuesto(p.id);
      if (r.error) setError(r.error);
    });
  };

  return (
    <Tarjeta className="p-4">
      <TituloSeccion
        accion={
          editable && hayLineas && (
            <Boton variante="secundario" className="min-h-10 px-3" onClick={() => setCreando(true)} disabled={pend}>
              {pend ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} {ultimoAprobado ? "Ampliar presupuesto" : presupuestos.length ? "Nuevo presupuesto" : "Crear presupuesto"}
            </Boton>
          )
        }
      >
        <span className="inline-flex items-center gap-2"><FileSignature className="size-4" aria-hidden /> Presupuestos</span>
      </TituloSeccion>

      {cambiado && (
        <div className="mb-3 flex flex-wrap items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Los importes han cambiado desde el presupuesto aceptado ({fmtEuros(ultimoAprobado.total)} → {fmtEuros(totalActual)}). Antes de hacer lo nuevo, el cliente debe aceptar la ampliación.
          </span>
          {editable && <Boton variante="secundario" className="min-h-10 px-3" onClick={() => setCreando(true)} disabled={pend}>Crear ampliación</Boton>}
        </div>
      )}
      {averiaPendiente && !pendiente && !cambiado && editable && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Hay una avería adicional que afecta al precio: añade lo nuevo en «Importes» y {ultimoAprobado ? "crea la ampliación" : "crea el presupuesto"} para que el cliente la acepte.</span>
        </p>
      )}

      {presupuestos.length === 0 ? (
        <Vacio>{hayLineas ? "Cuando estén los importes, crea el presupuesto para que el cliente lo acepte." : "Añade los importes para poder crear el presupuesto."}</Vacio>
      ) : (
        <ul className="space-y-2">
          {presupuestos.map((p) => {
            const e = p.estado === "pendiente" && p.caducado ? { t: "Caducado", c: "#64748b" } : ESTADO[p.estado];
            const vigente = p.estado === "pendiente" && !p.caducado;
            return (
              <li key={p.id} className={cx("rounded-xl border p-3", vigente ? "border-amber-200 bg-amber-50/40" : "border-slate-200")}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-semibold">{p.numero}</span>
                  {p.tipo === "complementario" && <Pastilla color="#7c3aed">Ampliación</Pastilla>}
                  <Pastilla color={e.c}>{e.t}</Pastilla>
                  <span className="ml-auto text-right">
                    <span className="block text-lg font-bold tabular-nums">{fmtEuros(p.total)}</span>
                    {p.amplia && (
                      <span className="block text-xs text-slate-500 tabular-nums">
                        {p.total - p.amplia.total >= 0 ? "+" : "−"}{fmtEuros(Math.abs(p.total - p.amplia.total))} sobre {p.amplia.numero}
                      </span>
                    )}
                  </span>
                </div>
                {(fmtHoras(p.horasEstimadas) || p.fechaEntrega) && (
                  <p className="text-sm text-slate-600">
                    {[fmtHoras(p.horasEstimadas) && `${p.amplia ? "Tiempo de más" : "Tiempo estimado"}: ${fmtHoras(p.horasEstimadas)}`, p.fechaEntrega && `${p.amplia ? "nueva entrega" : "entrega"} ${fmtFecha(p.fechaEntrega)}`].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-600">
                  {p.estado === "aprobado"
                    ? `Aceptado el ${fmtFecha(p.decididoEn)}${p.decididoNombre ? ` por ${p.decididoNombre}` : ""} (${VIA[p.decididoVia ?? "manual"]}${p.decisionNota ? `: ${p.decisionNota}` : ""})`
                    : p.estado === "rechazado"
                      ? `No aceptado el ${fmtFecha(p.decididoEn)}${p.decisionNota ? `: ${p.decisionNota}` : ""}`
                      : `Creado el ${fmtFecha(p.creadoEn)} · válido hasta el ${fmtFecha(p.validezHasta)}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {vigente && editable && (
                    <>
                      <Link href={`/ot/${otId}/presupuesto/${p.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                        <Tablet className="size-4" aria-hidden /> Firmar en la tablet
                      </Link>
                      {p.whatsapp && (
                        <a href={p.whatsapp} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white">
                          <MessageCircle className="size-4" aria-hidden /> Enviar por WhatsApp
                        </a>
                      )}
                      {p.enlace && (
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard?.writeText(p.enlace!).catch(() => {});
                            setCopiado(p.id);
                            setTimeout(() => setCopiado(null), 2000);
                          }}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {copiado === p.id ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copiado === p.id ? "Copiado" : "Copiar enlace"}
                        </button>
                      )}
                    </>
                  )}
                  <a href={`/api/presupuestos/${p.id}`} target="_blank" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                    <FileText className="size-4" aria-hidden /> {p.firmado ? "PDF firmado" : "Ver PDF"}
                  </a>
                  {vigente && editable && (
                    <>
                      <button type="button" onClick={() => setDialogo({ tipo: "aprobar", p })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        <Check className="size-4" aria-hidden /> Aprobado sin firma…
                      </button>
                      <button type="button" onClick={() => setDialogo({ tipo: "rechazar", p })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        <X className="size-4" aria-hidden /> No acepta…
                      </button>
                    </>
                  )}
                  {editable && (p.estado === "pendiente" || p.estado === "sustituido") && (
                    <button type="button" onClick={() => borrar(p)} disabled={pend} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="size-4" aria-hidden /> Borrar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Dialogo
        abierto={creando}
        onCerrar={() => setCreando(false)}
        titulo={ultimoAprobado ? `Ampliación del presupuesto ${ultimoAprobado.numero}` : "Nuevo presupuesto"}
        descripcion={
          ultimoAprobado
            ? `Ya aceptado: ${fmtEuros(ultimoAprobado.total)}. Nuevo total: ${fmtEuros(totalActual)} (${totalActual - ultimoAprobado.total >= 0 ? "+" : "−"}${fmtEuros(Math.abs(totalActual - ultimoAprobado.total))}). El cliente verá solo lo que cambia y la diferencia.`
            : `Total: ${fmtEuros(totalActual)}. Dile al cliente cuánto tiempo lleva y cuándo estará.`
        }
      >
        {creando && (
          <FormCrear
            otId={otId}
            ampliacion={!!ultimoAprobado}
            sustituye={pendiente?.numero ?? null}
            horas={horasSugeridas}
            fecha={fechaPrevista}
            onHecho={() => setCreando(false)}
          />
        )}
      </Dialogo>

      <Dialogo
        abierto={!!dialogo}
        onCerrar={() => setDialogo(null)}
        titulo={dialogo?.tipo === "aprobar" ? `Aprobar ${dialogo.p.numero} sin firma` : `El cliente no acepta ${dialogo?.p.numero ?? ""}`}
        descripcion={dialogo?.tipo === "aprobar" ? "Para cuando lo aprueba por teléfono, la aseguradora o el perito. Queda anotado quién y cómo." : "La orden sigue abierta: puedes hacer otro presupuesto o entregar el coche sin reparar."}
      >
        {dialogo && <FormDecision tipo={dialogo.tipo} presupuestoId={dialogo.p.id} cliente={cliente} onHecho={() => setDialogo(null)} />}
      </Dialogo>
    </Tarjeta>
  );
}

function FormDecision({ tipo, presupuestoId, cliente, onHecho }: { tipo: "aprobar" | "rechazar"; presupuestoId: string; cliente: string; onHecho: () => void }) {
  const [nombre, setNombre] = useState(cliente);
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
          const r = tipo === "aprobar" ? await aprobarSinFirma(presupuestoId, nombre, nota) : await rechazarPresupuesto(presupuestoId, nota);
          if (r.error) setError(r.error);
          else onHecho();
        });
      }}
    >
      {tipo === "aprobar" && (
        <Campo etiqueta="Quién lo aprueba" ayuda="El cliente, o la compañía / el perito en un siniestro.">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} />
        </Campo>
      )}
      <Campo etiqueta={tipo === "aprobar" ? "Cómo lo ha aprobado" : "Motivo (opcional)"}>
        <Input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          required={tipo === "aprobar"}
          minLength={tipo === "aprobar" ? 3 : undefined}
          placeholder={tipo === "aprobar" ? "Ej.: Por teléfono a las 12:30 / Autorizado por el perito" : "Ej.: Le parece caro"}
          autoFocus
        />
      </Campo>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} {tipo === "aprobar" ? "Marcar como aprobado" : "Marcar como no aceptado"}</Boton>
      </div>
    </form>
  );
}

const aTexto = (h: number) => (h > 0 ? String(Math.round(h * 100) / 100).replace(".", ",") : "");

function FormCrear({ otId, ampliacion, sustituye, horas, fecha, onHecho }: {
  otId: string;
  ampliacion: boolean;
  sustituye: string | null;
  horas: number;
  fecha: string | null;
  onHecho: () => void;
}) {
  const [h, setH] = useState(aTexto(horas));
  const [f, setF] = useState(fecha && fecha >= diaISO() ? fecha : "");
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const r = await crearPresupuesto(otId, { horas: h, fecha: f });
          if (r.error) setError(r.error);
          else onHecho();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta={ampliacion ? "Tiempo de más (horas)" : "Tiempo de trabajo (horas)"} ayuda="Calculado con la mano de obra. Puedes cambiarlo.">
          <Input value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" placeholder="Ej.: 4" className="max-w-32 tabular-nums" />
        </Campo>
        <Campo etiqueta={ampliacion ? "Nueva fecha de entrega" : "Entrega prevista"} ayuda="Al aceptarlo pasa a la orden.">
          <Input type="date" value={f} min={diaISO()} onChange={(e) => setF(e.target.value)} />
        </Campo>
      </div>
      {sustituye && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">El presupuesto {sustituye} aún está pendiente: este lo sustituye.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Boton type="button" variante="fantasma" onClick={onHecho}>Cancelar</Boton>
        <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" aria-hidden />} {ampliacion ? "Crear ampliación" : "Crear presupuesto"}</Boton>
      </div>
    </form>
  );
}
