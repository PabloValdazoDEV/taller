"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Mail, MessageCircle, Phone, Search } from "lucide-react";
import type { Dano } from "@/db/schema";
import { Boton, Campo, Input, Matricula, Select, Tarjeta, Textarea, cx } from "@/components/ui";
import { SiluetaDanos, VistasDanos } from "@/components/silueta-danos";
import { SelectorMarcaModelo, LogoMarca } from "@/components/selector-marca-modelo";
import { SelectorCombustible } from "@/components/combustible";
import { KmInput } from "@/components/km-input";
import { TelefonoInput } from "@/components/telefono-input";
import { FotosInput } from "@/components/fotos-input";
import { PanelFirma } from "@/components/firma";
import { fmtCombustible, fmtFechaHora, fmtKm } from "@/lib/formato";
import { zonaDano } from "@/lib/silueta";
import { separarTelefono } from "@/lib/telefono";
import { buscarPorMatricula, crearRecepcion } from "../actions";

type Tipo = { id: string; nombre: string; color: string; requiereSiniestro: boolean };
type Compania = { id: string; nombre: string; tipo: string };
export type Prefill = { buscar?: boolean; citaId?: string; matricula?: string; contacto?: string; telefono?: string; motivo?: string; tipoOrdenId?: string };

const TESTIGOS = ["Motor", "ABS", "Airbag", "Batería", "Aceite", "Frenos", "Temperatura", "Presión neumáticos"];
const OBJETOS = ["Llave (1)", "Llaves (2)", "Documentación", "Rueda de repuesto", "Gato / herramientas", "Tapacubos", "Silla infantil", "Objetos personales"];
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
    aceptaLlamada: true,
    aceptaWhatsapp: true,
    aceptaEmail: false,
    tipoOrdenId: prefill.tipoOrdenId ?? "",
    trabajo: prefill.motivo ?? "",
    fechaEntrada: "",
    fechaPrevista: "",
    renunciaPresupuesto: false,
    km: "",
    combustible: null as number | null,
    testigos: [] as string[],
    objetos: ["Llave (1)"] as string[],
    danos: [] as Dano[],
    observaciones: "",
    siniestro: { companiaId: "", numeroSiniestro: "", numeroPoliza: "", perito: "", franquicia: "", cubreSustitucion: false },
    firmante: "",
  });
  const [masDatos, setMasDatos] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [firma, setFirma] = useState<string | null>(null);

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
        aceptaLlamada: c?.aceptaLlamada ?? true,
        aceptaWhatsapp: c?.aceptaWhatsapp ?? true,
        aceptaEmail: c?.aceptaEmail ?? false,
      }));
      if (c?.nif || c?.email) setMasDatos(true);
    });
  }

  // Al entrar: recuperar borrador (si no se viene de una cita/cliente concreto), poner la hora local
  // de la tablet como fecha de recepción y, viniendo de la ficha del cliente (?matricula=), buscar.
  const [recuperado, setRecuperado] = useState(false);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const b = leerBorrador();
    const mismoOrigen = b && (b.d.citaId || "") === (prefill.citaId ?? "") && (!prefill.matricula || b.d.matricula === prefill.matricula);
    if (b && mismoOrigen && b.d.matricula) {
      setD((p) => ({ ...p, ...(b.d as Partial<typeof p>), fechaEntrada: b.d.fechaEntrada || ahoraLocal() }));
      setPaso(Math.min(b.paso, 3));
      setBusquedaHecha(b.busquedaHecha);
      if (b.d.clienteNif || b.d.clienteEmail) setMasDatos(true);
      setRecuperado(true);
    } else {
      set("fechaEntrada", ahoraLocal());
      if (prefill.buscar && d.matricula) buscar();
    }
    setListo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar borrador en cada cambio (sin fotos ni firma) y avisar antes de salir con datos sin firmar
  const hayDatos = !!d.matricula.trim();
  useEffect(() => {
    if (!listo) return;
    if (hayDatos) guardarBorrador({ d, paso, busquedaHecha });
  }, [d, paso, busquedaHecha, hayDatos, listo]);
  useEffect(() => {
    if (!hayDatos || enviando) return;
    const antesDeSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    // Navegación interna (menú lateral, enlaces): pedir confirmación
    const alPulsar = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || !a.href || a.href.startsWith(location.href.split("#")[0] + "#")) return;
      if (!confirm("Hay una recepción a medias. ¿Salir? (se guarda un borrador sin las fotos ni la firma)")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", antesDeSalir);
    document.addEventListener("click", alPulsar, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSalir);
      document.removeEventListener("click", alPulsar, true);
    };
  }, [hayDatos, enviando]);

  function descartarBorrador() {
    borrarBorrador();
    location.reload();
  }

  function validar(p: number): string {
    if (p === 0) {
      if (d.matricula.trim().length < 4) return "Introduce la matrícula";
      if (!busquedaHecha) return "Pulsa «Buscar» para comprobar si el vehículo ya existe";
      if (!d.marca) return "Elige la marca del vehículo";
      if (d.clienteNombre.trim().length < 2) return "Introduce el nombre del cliente";
      const digitos = separarTelefono(d.clienteTelefono).numero.replace(/\D/g, "").length;
      if (!digitos) return "Introduce el teléfono del cliente";
      if (digitos < 6) return "El teléfono parece incompleto";
    }
    if (p === 1) {
      if (!d.tipoOrdenId) return "Elige el tipo de orden";
      if (!d.fechaEntrada) return "Indica la fecha de recepción";
      if (new Date(d.fechaEntrada).getTime() > Date.now() + 5 * 60_000) return "La fecha de recepción no puede ser futura";
      if (tipoSel?.requiereSiniestro && !d.siniestro.companiaId) return "Indica la compañía";
    }
    if (p === 2) {
      if (!d.km) return "Introduce los kilómetros";
      if (d.combustible == null) return "Indica el nivel de combustible";
    }
    return "";
  }

  function siguiente() {
    const e = validar(paso);
    if (e) return setError(e);
    setError("");
    if (paso === 3 && !d.firmante) set("firmante", d.clienteNombre);
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        fechaEntrada: new Date(d.fechaEntrada).toISOString(),
        siniestro: tipoSel?.requiereSiniestro ? { ...d.siniestro, franquicia: d.siniestro.franquicia ? Number(d.siniestro.franquicia) : null } : null,
      }),
    );
    fd.set("firma", firma);
    fotos.forEach((f) => fd.append("fotos", f));
    startEnviar(async () => {
      borrarBorrador(); // si falla, se vuelve a guardar con el siguiente cambio
      const r = await crearRecepcion(fd);
      if (r?.error) {
        setError(r.error);
        guardarBorrador({ d, paso, busquedaHecha });
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Indicador de pasos */}
      <ol className="flex items-center gap-1 mb-6 overflow-x-auto">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={i > paso}
              onClick={() => i < paso && setPaso(i)}
              className={cx(
                "flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm",
                i === paso ? "bg-primary text-white font-semibold" : i < paso ? "bg-white text-slate-700 border border-slate-200" : "text-slate-400",
              )}
            >
              <span className={cx("size-6 rounded-full grid place-items-center text-xs font-bold", i === paso ? "bg-white/25" : i < paso ? "bg-emerald-500 text-white" : "bg-slate-200")}>
                {i < paso ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cx(i !== paso && "hidden sm:inline")}>{nombre}</span>
            </button>
            {i < PASOS.length - 1 && <ChevronRight className="size-4 text-slate-300" />}
          </li>
        ))}
      </ol>

      {recuperado && (
        <div className="mb-4 rounded-xl bg-sky-50 text-sky-900 text-sm p-3 flex flex-wrap items-center gap-3">
          <span className="flex-1">Se ha recuperado la recepción que estaba a medias. Las fotos y la firma hay que volver a hacerlas.</span>
          <button type="button" onClick={descartarBorrador} className="font-semibold underline min-h-10">Empezar de cero</button>
        </div>
      )}
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
                  <Campo etiqueta="Nombre y apellidos / razón social" className="sm:col-span-2 lg:col-span-1"><Input value={d.clienteNombre} onChange={(e) => set("clienteNombre", e.target.value)} className="text-lg" /></Campo>
                  <Campo etiqueta="Teléfono" className="sm:col-span-2 lg:col-span-1"><TelefonoInput value={d.clienteTelefono} onChange={(v) => set("clienteTelefono", v)} className="[&_input]:text-lg" /></Campo>
                  <div className="sm:col-span-2">
                    <span className="block text-sm font-medium text-slate-700 mb-2">Cómo avisarle</span>
                    <div className="flex flex-wrap gap-2">
                      <Aviso on={d.aceptaLlamada} onClick={() => set("aceptaLlamada", !d.aceptaLlamada)} icono={<Phone className="size-4" />} color="#0f766e">Llamada</Aviso>
                      <Aviso on={d.aceptaWhatsapp} onClick={() => set("aceptaWhatsapp", !d.aceptaWhatsapp)} icono={<MessageCircle className="size-4" />} color="#25D366">WhatsApp</Aviso>
                      {d.clienteEmail && (
                        <Aviso on={d.aceptaEmail} onClick={() => set("aceptaEmail", !d.aceptaEmail)} icono={<Mail className="size-4" />} color="#2563eb">Email</Aviso>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => setMasDatos((v) => !v)} className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
                      <ChevronDown className={cx("size-4 transition", masDatos && "rotate-180")} />
                      Más datos (DNI, email) <span className="text-slate-400 font-normal">· opcional</span>
                    </button>
                    {masDatos && (
                      <div className="grid sm:grid-cols-2 gap-4 mt-3">
                        <Campo etiqueta="NIF / DNI"><Input value={d.clienteNif} onChange={(e) => set("clienteNif", e.target.value.toUpperCase())} /></Campo>
                        <Campo etiqueta="Email">
                          <Input
                            type="email"
                            value={d.clienteEmail}
                            onChange={(e) => setD((p) => ({ ...p, clienteEmail: e.target.value, aceptaEmail: p.clienteEmail ? p.aceptaEmail : !!e.target.value }))}
                          />
                        </Campo>
                      </div>
                    )}
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

            <Campo
              etiqueta="Detalles del trabajo (opcional)"
              ayuda={tipoSel ? `Si lo dejas vacío, en el resguardo figurará «${tipoSel.nombre}».` : undefined}
            >
              <Textarea value={d.trabajo} onChange={(e) => set("trabajo", e.target.value)} rows={3} placeholder="Ej.: Revisión de los 90.000 km y ruido al girar a la derecha" />
            </Campo>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Fecha y hora de recepción" ayuda="Cámbiala si el coche se dejó antes (p. ej. fuera de horario)">
                <Input type="datetime-local" value={d.fechaEntrada} max={ahoraLocal()} onChange={(e) => set("fechaEntrada", e.target.value)} />
              </Campo>
              <Campo etiqueta="Fecha prevista de entrega"><Input type="date" value={d.fechaPrevista} min={d.fechaEntrada.slice(0, 10)} onChange={(e) => set("fechaPrevista", e.target.value)} /></Campo>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm min-h-11">
                <input type="checkbox" className="size-5" checked={d.renunciaPresupuesto} onChange={(e) => set("renunciaPresupuesto", e.target.checked)} />
                El cliente renuncia a presupuesto previo
              </label>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Kilómetros"><KmInput value={d.km} onChange={(v) => set("km", v)} placeholder="125.000" className="text-xl font-semibold tabular-nums" /></Campo>
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
            <FotosInput onChange={setFotos} />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-[1fr_280px] gap-6">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Vehículo</dt>
                <dd className="flex items-center gap-2 flex-wrap"><Matricula>{d.matricula}</Matricula>{d.marca && <LogoMarca marca={d.marca} className="size-6" />} {d.marca} {d.modelo}</dd>
                <dt className="text-slate-500">Cliente</dt>
                <dd>{d.clienteNombre} {d.clienteTelefono && `· ${d.clienteTelefono}`}</dd>
                <dt className="text-slate-500">Tipo</dt>
                <dd>{tipoSel?.nombre}{d.siniestro.numeroSiniestro && tipoSel?.requiereSiniestro ? ` · ${companias.find((c) => c.id === d.siniestro.companiaId)?.nombre} ${d.siniestro.numeroSiniestro}` : ""}</dd>
                <dt className="text-slate-500">Trabajo</dt>
                <dd>{d.trabajo.trim() || tipoSel?.nombre}</dd>
                <dt className="text-slate-500">Recepción</dt>
                <dd>{d.fechaEntrada && fmtFechaHora(new Date(d.fechaEntrada))}</dd>
                <dt className="text-slate-500">Km / comb.</dt>
                <dd>{fmtKm(Number(d.km))} · {fmtCombustible(d.combustible)}</dd>
                <dt className="text-slate-500">Testigos</dt>
                <dd>{d.testigos.join(", ") || "Ninguno"}</dd>
                <dt className="text-slate-500">Objetos</dt>
                <dd>{d.objetos.join(", ") || "Ninguno"}</dd>
                <dt className="text-slate-500">Daños</dt>
                <dd>{d.danos.length ? d.danos.map((x, i) => `${i + 1}. ${x.tipo} (${zonaDano(x)})`).join(" · ") : "Sin daños"}</dd>
                <dt className="text-slate-500">Fotos</dt>
                <dd>{fotos.length}</dd>
                <dt className="text-slate-500">Presupuesto</dt>
                <dd>{d.renunciaPresupuesto ? "Renuncia a presupuesto previo" : "Se facilitará presupuesto"}</dd>
              </dl>
              <VistasDanos danos={d.danos} />
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
          <Boton type="button" variante="secundario" onClick={() => { setError(""); setPaso((p) => Math.max(0, p - 1)); }} disabled={paso === 0 || enviando}>
            <ChevronLeft className="size-4" /> Atrás
          </Boton>
          {paso < PASOS.length - 1 ? (
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

// ── Borrador en la sesión del navegador (se pierde al cerrar la pestaña; nunca incluye fotos ni firma) ──
const CLAVE_BORRADOR = "taller:borrador-recepcion";
type Borrador = { d: Record<string, unknown> & { matricula: string; citaId: string; fechaEntrada: string; clienteNif?: string; clienteEmail?: string }; paso: number; busquedaHecha: boolean };
function leerBorrador(): Borrador | null {
  try {
    const v = sessionStorage.getItem(CLAVE_BORRADOR);
    return v ? (JSON.parse(v) as Borrador) : null;
  } catch {
    return null;
  }
}
function guardarBorrador(b: { d: object; paso: number; busquedaHecha: boolean }) {
  try {
    sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
function borrarBorrador() {
  try {
    sessionStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* idem */
  }
}

/** Fecha y hora actuales en formato de <input type="datetime-local"> (hora local del dispositivo). */
function ahoraLocal() {
  const n = new Date();
  return new Date(n.getTime() - n.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Aviso({ on, onClick, icono, color, children }: { on: boolean; onClick: () => void; icono: ReactNode; color: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx("min-h-11 rounded-full px-4 text-sm font-semibold border-2 inline-flex items-center gap-2 transition", on ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-500")}
      style={on ? { background: color } : undefined}
    >
      {on ? <Check className="size-4" /> : icono}
      {children}
    </button>
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
