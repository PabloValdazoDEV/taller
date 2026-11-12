"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Search } from "lucide-react";
import type { Dano } from "@/db/schema";
import { Boton, Campo, Input, Matricula, Select, Tarjeta, Textarea, cx } from "@/components/ui";
import { SiluetaDanos, VistasDanos } from "@/components/silueta-danos";
import { SelectorMarcaModelo, LogoMarca } from "@/components/selector-marca-modelo";
import { SelectorCombustible } from "@/components/combustible";
import { FotosInput } from "@/components/fotos-input";
import { PanelFirma } from "@/components/firma";
import { fmtCombustible } from "@/lib/formato";
import { zonaDano } from "@/lib/silueta";
import { buscarPorMatricula, crearRecepcion } from "../actions";

type Tipo = { id: string; nombre: string; color: string; requiereSiniestro: boolean };
type Compania = { id: string; nombre: string; tipo: string };
export type Prefill = { buscar?: boolean; citaId?: string; matricula?: string; contacto?: string; telefono?: string; motivo?: string; tipoOrdenId?: string };

const TESTIGOS = ["Motor", "ABS", "Airbag", "Batería", "Aceite", "Frenos", "Temperatura", "Presión neumáticos"];
const OBJETOS = ["Llaves (2)", "Llave (1)", "Documentación", "Rueda de repuesto", "Gato / herramientas", "Tapacubos", "Silla infantil", "Objetos personales"];
const PASOS = ["Vehículo y cliente", "Trabajo", "Estado del vehículo", "Fotos", "Revisión y firma"];

export function AsistenteRecepcion({ tipos, companias, prefill }: { tipos: Tipo[]; companias: Compania[]; prefill: Prefill }) {
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState("");
  const [buscando, startBuscar] = useTransition();
  const [enviando, startEnviar] = useTransition();
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [otAbierta, setOtAbierta] = useState<{ id: string; numero: string } | null>(null);

  const [d, setD] = useState({
    citaId: prefill.citaId ?? "",
    vehiculoId: "",
    clienteId: "",
    matricula: prefill.matricula ?? "",
    marca: "",
    modelo: "",
    bastidor: "",
    color: "",
    clienteNombre: prefill.contacto ?? "",
    clienteNif: "",
    clienteTelefono: prefill.telefono ?? "",
    clienteEmail: "",
    aceptaWhatsapp: true,
    aceptaEmail: true,
    tipoOrdenId: prefill.tipoOrdenId ?? "",
    trabajo: prefill.motivo ?? "",
    fechaPrevista: "",
    renunciaPresupuesto: false,
    km: "",
    combustible: null as number | null,
    testigos: [] as string[],
    objetos: ["Llaves (2)", "Documentación"] as string[],
    danos: [] as Dano[],
    observaciones: "",
    siniestro: { companiaId: "", numeroSiniestro: "", numeroPoliza: "", perito: "", franquicia: "", cubreSustitucion: false },
    firmante: "",
  });
  const [fotos, setFotos] = useState<File[]>([]);
  const [firma, setFirma] = useState<string | null>(null);
  // Si se vuelve desde la firma para corregir algo, se ofrece regresar directamente a ella.
  const [desdeFirma, setDesdeFirma] = useState(false);

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));
  const tipoSel = tipos.find((tp) => tp.id === d.tipoOrdenId);

  function buscar() {
    setError("");
    startBuscar(async () => {
      const r = await buscarPorMatricula(d.matricula);
      setBusquedaHecha(true);
      setOtAbierta(r?.otAbierta ?? null);
      if (!r) {
        setD((p) => ({ ...p, vehiculoId: "", clienteId: "" }));
        return;
      }
      const { vehiculo: v, cliente: c } = r;
      setD((p) => ({
        ...p,
        vehiculoId: v.id,
        matricula: v.matricula,
        marca: v.marca ?? "",
        modelo: v.modelo ?? "",
        bastidor: v.bastidor ?? "",
        color: v.color ?? "",
        km: v.kmUltimo != null ? String(v.kmUltimo) : p.km,
        clienteId: c?.id ?? "",
        clienteNombre: c?.nombre ?? p.clienteNombre,
        clienteNif: c?.nif ?? "",
        clienteTelefono: c?.telefono ?? p.clienteTelefono,
        clienteEmail: c?.email ?? "",
        aceptaWhatsapp: c?.aceptaWhatsapp ?? true,
        aceptaEmail: c?.aceptaEmail ?? true,
      }));
    });
  }

  // Viniendo de la ficha del cliente (?matricula=): buscar automáticamente
  useEffect(() => {
    if (prefill.buscar && d.matricula) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validar(p: number): string {
    if (p === 0) {
      if (d.matricula.trim().length < 4) return "Introduce la matrícula";
      if (!busquedaHecha) return "Pulsa «Buscar» para comprobar si el vehículo ya existe";
      if (!d.marca) return "Elige la marca del vehículo";
      if (d.clienteNombre.trim().length < 2) return "Introduce el nombre del cliente";
      if (!d.clienteTelefono && !d.clienteEmail) return "Introduce al menos un teléfono o un email de contacto";
    }
    if (p === 1) {
      if (!d.tipoOrdenId) return "Elige el tipo de orden";
      if (d.trabajo.trim().length < 3) return "Describe el trabajo solicitado";
      if (tipoSel?.requiereSiniestro && !d.siniestro.companiaId) return "Indica la compañía";
    }
    if (p === 2) {
      if (!d.km) return "Introduce los kilómetros";
      if (d.combustible == null) return "Indica el nivel de combustible";
    }
    return "";
  }

  function irA(p: number) {
    setError("");
    // La firma da conformidad a los datos: si se vuelve a corregir algo, el cliente firma de nuevo.
    if (paso === PASOS.length - 1 && p < paso) {
      setFirma(null);
      setDesdeFirma(true);
    }
    if (p === PASOS.length - 1) {
      setDesdeFirma(false);
      if (!d.firmante) set("firmante", d.clienteNombre);
    }
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function siguiente() {
    const e = validar(paso);
    if (e) return setError(e);
    irA(Math.min(paso + 1, PASOS.length - 1));
  }

  /** Vuelve a «Revisión y firma» comprobando todos los pasos; si alguno está incompleto, se queda en él. */
  function volverAFirma() {
    for (let p = 0; p < PASOS.length - 1; p++) {
      const e = validar(p);
      if (e) {
        if (p !== paso) irA(p);
        return setError(e);
      }
    }
    irA(PASOS.length - 1);
  }

  function enviar() {
    if (!firma) return setError("Falta la firma del cliente");
    if (d.firmante.trim().length < 2) return setError("Indica el nombre de quien firma");
    setError("");
    const fd = new FormData();
    fd.set(
      "datos",
      JSON.stringify({
        ...d,
        km: d.km ? Number(d.km) : null,
        siniestro: tipoSel?.requiereSiniestro ? { ...d.siniestro, franquicia: d.siniestro.franquicia ? Number(d.siniestro.franquicia) : null } : null,
      }),
    );
    fd.set("firma", firma);
    fotos.forEach((f) => fd.append("fotos", f));
    startEnviar(async () => {
      const r = await crearRecepcion(fd);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Indicador de pasos: en el móvil, «Paso X de N» + barra; en tablet/PC, todos los pasos */}
      <div className="mb-5 sm:hidden" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-900">{PASOS[paso]}</span>
          <span className="shrink-0 text-slate-500">Paso {paso + 1} de {PASOS.length}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={1} aria-valuemax={PASOS.length} aria-valuenow={paso + 1} aria-label="Progreso de la recepción">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} />
        </div>
      </div>
      <ol className="mb-6 hidden flex-wrap items-center gap-1 sm:flex">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={i > paso}
              onClick={() => i < paso && irA(i)}
              className={cx(
                "flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm",
                i === paso ? "bg-primary text-white font-semibold" : i < paso ? "bg-white text-slate-700 border border-slate-200" : "text-slate-400",
              )}
            >
              <span className={cx("size-6 rounded-full grid place-items-center text-xs font-bold", i === paso ? "bg-white/25" : i < paso ? "bg-emerald-500 text-white" : "bg-slate-200")}>
                {i < paso ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span>{nombre}</span>
            </button>
            {i < PASOS.length - 1 && <ChevronRight className="size-4 text-slate-300" />}
          </li>
        ))}
      </ol>

      <Tarjeta className="p-4 md:p-6">
        {paso === 0 && (
          <div className="space-y-5">
            <div className="flex gap-2 items-end">
              <Campo etiqueta="Matrícula" className="flex-1">
                <Input
                  value={d.matricula}
                  onChange={(e) => {
                    set("matricula", e.target.value.toUpperCase());
                    setBusquedaHecha(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
                  placeholder="1234 ABC"
                  className="text-2xl font-mono font-bold tracking-widest uppercase min-h-14"
                  autoFocus
                />
              </Campo>
              <Boton type="button" onClick={buscar} disabled={buscando || d.matricula.length < 4} className="min-h-14 px-5">
                {buscando ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />} Buscar
              </Boton>
            </div>

            {busquedaHecha && (
              <div className={cx("rounded-xl p-3 text-sm", d.vehiculoId ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800")}>
                {d.vehiculoId ? "Vehículo encontrado: revisa y actualiza los datos de contacto si han cambiado." : "Vehículo nuevo: completa sus datos y los del cliente."}
              </div>
            )}
            {otAbierta && (
              <div className="rounded-xl p-3 text-sm bg-amber-50 text-amber-800 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  Este vehículo ya tiene una orden abierta (<Link className="underline font-semibold" href={`/ot/${otAbierta.id}`}>{otAbierta.numero}</Link>). Puedes continuar si es un trabajo distinto.
                </span>
              </div>
            )}

            {busquedaHecha && (
              <>
                <fieldset className="grid sm:grid-cols-2 gap-4">
                  <legend className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Vehículo</legend>
                  <div className="sm:col-span-2">
                    <SelectorMarcaModelo marca={d.marca} modelo={d.modelo} onChange={(marca, modelo) => setD((p) => ({ ...p, marca, modelo }))} />
                  </div>
                  <Campo etiqueta="Bastidor (VIN)"><Input value={d.bastidor} onChange={(e) => set("bastidor", e.target.value.toUpperCase())} className="font-mono" /></Campo>
                  <Campo etiqueta="Color"><Input value={d.color} onChange={(e) => set("color", e.target.value)} /></Campo>
                </fieldset>
                <fieldset className="grid sm:grid-cols-2 gap-4">
                  <legend className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Cliente</legend>
                  <Campo etiqueta="Nombre y apellidos / razón social" className="sm:col-span-2"><Input value={d.clienteNombre} onChange={(e) => set("clienteNombre", e.target.value)} /></Campo>
                  <Campo etiqueta="NIF / DNI"><Input value={d.clienteNif} onChange={(e) => set("clienteNif", e.target.value.toUpperCase())} /></Campo>
                  <Campo etiqueta="Teléfono"><Input type="tel" value={d.clienteTelefono} onChange={(e) => set("clienteTelefono", e.target.value)} /></Campo>
                  <Campo etiqueta="Email" className="sm:col-span-2"><Input type="email" value={d.clienteEmail} onChange={(e) => set("clienteEmail", e.target.value)} /></Campo>
                  <div className="sm:col-span-2 flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={d.aceptaWhatsapp} onChange={(e) => set("aceptaWhatsapp", e.target.checked)} /> Acepta avisos por WhatsApp</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={d.aceptaEmail} onChange={(e) => set("aceptaEmail", e.target.checked)} /> Acepta avisos por email</label>
                  </div>
                </fieldset>
              </>
            )}
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-5">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Tipo de orden</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {tipos.map((tp) => (
                  <button
                    type="button"
                    key={tp.id}
                    onClick={() => set("tipoOrdenId", tp.id)}
                    className={cx("min-h-16 rounded-xl border-2 px-3 text-sm font-semibold text-left transition", d.tipoOrdenId === tp.id ? "text-white" : "bg-white border-slate-200")}
                    style={d.tipoOrdenId === tp.id ? { background: tp.color, borderColor: tp.color } : { borderLeftColor: tp.color, borderLeftWidth: 6 }}
                  >
                    {tp.nombre}
                  </button>
                ))}
              </div>
            </div>

            {tipoSel?.requiereSiniestro && (
              <fieldset className="grid sm:grid-cols-2 gap-4 rounded-xl bg-violet-50 p-4">
                <legend className="text-sm font-semibold text-violet-800 px-1">Datos de la compañía</legend>
                <Campo etiqueta="Compañía" className="sm:col-span-2">
                  <Select value={d.siniestro.companiaId} onChange={(e) => set("siniestro", { ...d.siniestro, companiaId: e.target.value })}>
                    <option value="">— Elige —</option>
                    {companias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </Select>
                </Campo>
                <Campo etiqueta="Nº siniestro / autorización"><Input value={d.siniestro.numeroSiniestro} onChange={(e) => set("siniestro", { ...d.siniestro, numeroSiniestro: e.target.value })} /></Campo>
                <Campo etiqueta="Nº póliza / contrato"><Input value={d.siniestro.numeroPoliza} onChange={(e) => set("siniestro", { ...d.siniestro, numeroPoliza: e.target.value })} /></Campo>
                <Campo etiqueta="Perito (si se conoce)"><Input value={d.siniestro.perito} onChange={(e) => set("siniestro", { ...d.siniestro, perito: e.target.value })} /></Campo>
                <Campo etiqueta="Franquicia (€)"><Input inputMode="decimal" value={d.siniestro.franquicia} onChange={(e) => set("siniestro", { ...d.siniestro, franquicia: e.target.value.replace(",", ".") })} /></Campo>
                <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={d.siniestro.cubreSustitucion} onChange={(e) => set("siniestro", { ...d.siniestro, cubreSustitucion: e.target.checked })} /> La póliza cubre coche de sustitución</label>
              </fieldset>
            )}

            <Campo etiqueta="Trabajo solicitado por el cliente">
              <Textarea value={d.trabajo} onChange={(e) => set("trabajo", e.target.value)} rows={4} placeholder="Ej.: Revisión de los 90.000 km y ruido al girar a la derecha" />
            </Campo>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Fecha prevista de entrega"><Input type="date" value={d.fechaPrevista} onChange={(e) => set("fechaPrevista", e.target.value)} /></Campo>
              <label className="flex items-center gap-2 text-sm self-end min-h-11">
                <input type="checkbox" className="size-5" checked={d.renunciaPresupuesto} onChange={(e) => set("renunciaPresupuesto", e.target.checked)} />
                El cliente renuncia a presupuesto previo
              </label>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Kilómetros"><Input inputMode="numeric" value={d.km} onChange={(e) => set("km", e.target.value.replace(/\D/g, ""))} className="text-xl font-semibold tabular-nums" /></Campo>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">Combustible</span>
                <SelectorCombustible value={d.combustible} onChange={(v) => set("combustible", v)} />
              </div>
            </div>
            <Chips titulo="Testigos encendidos en el cuadro" opciones={TESTIGOS} valor={d.testigos} onChange={(v) => set("testigos", v)} color="#dc2626" />
            <Chips titulo="Objetos y accesorios que se quedan" opciones={OBJETOS} valor={d.objetos} onChange={(v) => set("objetos", v)} />
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Daños visibles a la entrada</span>
              <SiluetaDanos value={d.danos} onChange={(v) => set("danos", v)} />
            </div>
            <Campo etiqueta="Observaciones"><Textarea value={d.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={2} /></Campo>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Haz fotos de los cuatro lados, del cuadro (km) y de cada daño marcado. Se comprimen automáticamente antes de subirlas.</p>
            <FotosInput inicial={fotos} onChange={setFotos} />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-6">
            <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
              Revisa los datos con el cliente antes de firmar. Si falta algo (una foto, un daño, un objeto…), pulsa <b>Cambiar</b> en ese bloque.
            </p>
            <div className={cx("grid gap-4", d.danos.length > 0 && "md:grid-cols-[1fr_280px]")}>
              <div className="space-y-3">
                <BloqueRevision titulo={PASOS[0]} onCambiar={() => irA(0)}>
                  <Fila t="Vehículo"><span className="inline-flex flex-wrap items-center gap-2"><Matricula>{d.matricula}</Matricula>{d.marca && <LogoMarca marca={d.marca} className="size-6" />} {d.marca} {d.modelo}</span></Fila>
                  <Fila t="Cliente">{d.clienteNombre} {d.clienteTelefono && `· ${d.clienteTelefono}`}</Fila>
                </BloqueRevision>
                <BloqueRevision titulo={PASOS[1]} onCambiar={() => irA(1)}>
                  <Fila t="Tipo">{tipoSel?.nombre}{d.siniestro.numeroSiniestro && tipoSel?.requiereSiniestro ? ` · ${companias.find((c) => c.id === d.siniestro.companiaId)?.nombre} ${d.siniestro.numeroSiniestro}` : ""}</Fila>
                  <Fila t="Trabajo"><span className="whitespace-pre-line">{d.trabajo}</span></Fila>
                  <Fila t="Presupuesto">{d.renunciaPresupuesto ? "Renuncia a presupuesto previo" : "Se facilitará presupuesto"}</Fila>
                </BloqueRevision>
                <BloqueRevision titulo={PASOS[2]} onCambiar={() => irA(2)}>
                  <Fila t="Km / comb.">{Number(d.km).toLocaleString("es-ES")} km · {fmtCombustible(d.combustible)}</Fila>
                  <Fila t="Testigos">{d.testigos.join(", ") || "Ninguno"}</Fila>
                  <Fila t="Objetos">{d.objetos.join(", ") || "Ninguno"}</Fila>
                  <Fila t="Daños">{d.danos.length ? d.danos.map((x, i) => `${i + 1}. ${x.tipo} (${zonaDano(x)})`).join(" · ") : "Sin daños"}</Fila>
                  {d.observaciones && <Fila t="Observ.">{d.observaciones}</Fila>}
                </BloqueRevision>
                <BloqueRevision titulo={PASOS[3]} onCambiar={() => irA(3)} sinLista>
                  {fotos.length ? <Miniaturas fotos={fotos} /> : <p className="text-sm text-amber-700">No se ha hecho ninguna foto.</p>}
                </BloqueRevision>
              </div>
              {d.danos.length > 0 && <VistasDanos danos={d.danos} />}
            </div>
            <div className="rounded-xl bg-slate-50 p-4 space-y-4 border border-slate-200">
              <p className="text-sm text-slate-600">
                Entregue la tablet al cliente. Al firmar declara conformes los datos, el estado del vehículo y las condiciones del resguardo de depósito.
              </p>
              <Campo etiqueta="Nombre de quien firma"><Input value={d.firmante} onChange={(e) => set("firmante", e.target.value)} /></Campo>
              <PanelFirma onChange={setFirma} />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 text-red-700 text-sm p-3" role="alert">{error}</p>
        )}

        <div className="mt-6 flex justify-between gap-3">
          <Boton type="button" variante="secundario" onClick={() => irA(Math.max(0, paso - 1))} disabled={paso === 0 || enviando}>
            <ChevronLeft className="size-4" /> Atrás
          </Boton>
          {desdeFirma && paso < PASOS.length - 1 ? (
            <Boton type="button" onClick={volverAFirma} className="px-5">
              Volver a la firma <ChevronRight className="size-4" />
            </Boton>
          ) : paso < PASOS.length - 1 ? (
            <Boton type="button" onClick={siguiente} className="px-6">
              Siguiente <ChevronRight className="size-4" />
            </Boton>
          ) : (
            <Boton type="button" variante="exito" onClick={enviar} disabled={enviando || !firma} className="px-6 text-base min-h-12">
              {enviando ? <><Loader2 className="size-5 animate-spin" /> Generando resguardo…</> : <><Check className="size-5" /> Firmar y crear orden</>}
            </Boton>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}

function BloqueRevision({ titulo, onCambiar, children, sinLista }: { titulo: string; onCambiar: () => void; children: React.ReactNode; sinLista?: boolean }) {
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
        <button type="button" onClick={onCambiar} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100" aria-label={`Cambiar: ${titulo}`}>
          <Pencil className="size-4" aria-hidden /> Cambiar
        </button>
      </div>
      {sinLista ? children : <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">{children}</dl>}
    </section>
  );
}

function Fila({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{t}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** Vista previa de las fotos ya hechas (en la revisión). */
function Miniaturas({ fotos }: { fotos: File[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = fotos.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [fotos]);
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
      ))}
    </div>
  );
}

function Chips({ titulo, opciones, valor, onChange, color }: { titulo: string; opciones: string[]; valor: string[]; onChange: (v: string[]) => void; color?: string }) {
  const [otro, setOtro] = useState("");
  const extras = valor.filter((v) => !opciones.includes(v));
  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-2">{titulo}</span>
      <div className="flex flex-wrap gap-2">
        {[...opciones, ...extras].map((o) => {
          const on = valor.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => onChange(on ? valor.filter((v) => v !== o) : [...valor, o])}
              className={cx("min-h-10 rounded-full px-4 text-sm font-medium border transition", on ? "text-white border-transparent" : "bg-white border-slate-300 text-slate-700")}
              style={on ? { background: color ?? "var(--primary)" } : undefined}
            >
              {o}
            </button>
          );
        })}
        <form
          className="flex"
          onSubmit={(e) => {
            e.preventDefault();
            if (otro.trim()) onChange([...valor, otro.trim()]);
            setOtro("");
          }}
        >
          <input value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Otro…" className="min-h-10 w-32 rounded-full border border-dashed border-slate-300 px-4 text-sm" />
        </form>
      </div>
    </div>
  );
}
