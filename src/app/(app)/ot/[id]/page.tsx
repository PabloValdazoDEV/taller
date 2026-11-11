import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Car, CheckCircle2, FileText, History, Image as ImageIcon, MessageCircle, ShieldCheck, Wrench } from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { getOT, mecanicos as listarMecanicos } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { BotonLink, Matricula, Pastilla, Tarjeta, TituloSeccion, Vacio, cx } from "@/components/ui";
import { VistasDanos } from "@/components/silueta-danos";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { zonaDano } from "@/lib/silueta";
import { enlaceWhatsapp, fmtCombustible, fmtFecha, fmtFechaHora, fmtKm, TIPO_DOCUMENTO, TIPO_INCIDENCIA } from "@/lib/formato";
import { CompartirDocumento } from "@/components/compartir-documento";
import { enlaceDocumento } from "@/lib/enlaces";
import { AsignarMecanico, FlujoEstados, NuevaIncidencia, ResolverIncidencia, SubirFotos } from "./controles";

export const dynamic = "force-dynamic";

const COLOR_INC: Record<string, string> = { abierta: "#d97706", en_curso: "#2563eb", resuelta: "#059669", descartada: "#64748b" };

export default async function FichaOT({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string; entregada?: string }> }) {
  const s = await requireSesion();
  const { id } = await params;
  const sp = await searchParams;
  const ot = await getOT(s.tid, id);
  if (!ot) notFound();
  const [mecs, taller] = await Promise.all([listarMecanicos(s.tid), tallerPorId(s.tid)]);

  const esOficina = s.rol !== "mecanico";
  const cerrada = !!ot.ot.cerradaEn;
  const listo = ot.estado.marca === "listo";
  const sin = ot.ot.datosSiniestro;
  const prestamoActivo = ot.prestamos.find((p) => !p.p.devueltoEn);
  const resguardo = ot.documentos.find((d) => d.tipo === "resguardo");
  const actaEntrega = ot.documentos.find((d) => d.tipo === "entrega");
  const enlaces = Object.fromEntries(await Promise.all(ot.documentos.map(async (d) => [d.id, await enlaceDocumento(d.id, s.tid)] as const)));
  const saludo = `Hola ${ot.cliente.nombre.split(" ")[0]}`;
  const mensajeDoc = (tipo: string) =>
    `${saludo}, le enviamos desde ${taller.nombre} su ${TIPO_DOCUMENTO[tipo]?.toLowerCase() ?? "documento"} del vehículo ${ot.vehiculo.matricula} (orden ${ot.ot.numero}).`;
  const ficheroDoc = (tipo: string) => `${TIPO_DOCUMENTO[tipo] ?? "Documento"} ${ot.vehiculo.matricula.replace(/\s/g, "")} ${ot.ot.numero}.pdf`;
  const docProps = (d: { id: string; tipo: string }) => ({
    docId: d.id,
    enlace: enlaces[d.id],
    telefono: ot.cliente.telefono,
    mensaje: mensajeDoc(d.tipo),
    nombreFichero: ficheroDoc(d.tipo),
  });
  const fotosAntes = ot.archivos.filter((a) => a.entidad === "recepcion");
  const fotosDespues = ot.archivos.filter((a) => a.entidad === "entrega");
  const fotosDurante = ot.archivos.filter((a) => a.entidad !== "recepcion" && a.entidad !== "entrega");
  const wa = enlaceWhatsapp(
    ot.cliente.telefono,
    listo
      ? `Hola ${ot.cliente.nombre.split(" ")[0]}, le escribimos de ${taller.nombre}. Su ${ot.vehiculo.marca ?? "vehículo"} ${ot.vehiculo.modelo ?? ""} (${ot.vehiculo.matricula}) ya está listo para recoger. ¡Gracias!`
      : `Hola ${ot.cliente.nombre.split(" ")[0]}, le escribimos de ${taller.nombre} sobre su vehículo ${ot.vehiculo.matricula} (orden ${ot.ot.numero}). Estado actual: ${ot.estado.nombre}.`,
  );

  return (
    <div className="space-y-5">
      {sp.nueva && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-wrap items-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-600" />
          <div className="flex-1">
            <div className="font-semibold text-emerald-900">Recepción firmada. Orden {ot.ot.numero} creada.</div>
            <div className="text-sm text-emerald-800">El resguardo en PDF está guardado con su huella SHA-256.</div>
          </div>
          {resguardo && <BotonLink variante="exito" href={`/api/documentos/${resguardo.id}`} target="_blank">Ver resguardo</BotonLink>}
          {resguardo && (
            <div className="w-full border-t border-emerald-200 pt-3">
              <div className="text-sm font-medium text-emerald-900 mb-2">Enviar el resguardo al cliente</div>
              <CompartirDocumento {...docProps(resguardo)} />
            </div>
          )}
        </div>
      )}
      {sp.entregada && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-wrap items-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-600" />
          <div className="font-semibold text-emerald-900 flex-1">Vehículo entregado y acta firmada.</div>
          {actaEntrega && <BotonLink variante="exito" href={`/api/documentos/${actaEntrega.id}`} target="_blank">Ver acta</BotonLink>}
          {actaEntrega && (
            <div className="w-full border-t border-emerald-200 pt-3">
              <div className="text-sm font-medium text-emerald-900 mb-2">Enviar el acta de entrega al cliente</div>
              <CompartirDocumento {...docProps(actaEntrega)} />
            </div>
          )}
        </div>
      )}

      {/* Cabecera */}
      <Tarjeta className="p-4 md:p-5" style={{ borderTop: `4px solid ${ot.tipo.color}` }}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-60">
            <div className="flex items-center gap-3 flex-wrap">
              <Matricula grande>{ot.vehiculo.matricula}</Matricula>
              <Pastilla color={ot.tipo.color}>{ot.tipo.nombre}</Pastilla>
              <span className="font-mono text-sm text-slate-400">{ot.ot.numero}</span>
            </div>
            <h1 className="text-xl font-bold mt-2 flex items-center gap-2 flex-wrap">{ot.vehiculo.marca && <LogoMarca marca={ot.vehiculo.marca} className="size-8" />}{ot.vehiculo.marca} {ot.vehiculo.modelo} <span className="text-slate-400 font-normal text-base">{ot.vehiculo.color}</span></h1>
            <div className="text-sm text-slate-600">
              {ot.cliente.nombre}
              {ot.cliente.telefono && <> · <a className="underline" href={`tel:${ot.cliente.telefono}`}>{ot.cliente.telefono}</a></>}
              {ot.cliente.exentoIva && <Pastilla color="#0369a1" className="ml-2">Exento IVA</Pastilla>}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Entrada {fmtFechaHora(ot.ot.fechaEntrada)} · Prevista {fmtFecha(ot.ot.fechaPrevista)} · Recibido por {ot.asesorNombre ?? "—"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {esOficina && wa && ot.cliente.aceptaWhatsapp && (
              <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] text-white px-4 min-h-11 text-sm font-semibold">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
            {esOficina && !cerrada && !prestamoActivo && (
              <BotonLink variante="secundario" href={`/ot/${ot.ot.id}/prestamo`}><Car className="size-4" /> Coche sustitución</BotonLink>
            )}
            {esOficina && listo && !cerrada && <BotonLink variante="exito" href={`/ot/${ot.ot.id}/entrega`}>Entregar vehículo</BotonLink>}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 grid md:grid-cols-[1fr_220px] gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Estado</div>
            <FlujoEstados
              otId={ot.ot.id}
              estados={ot.estados}
              actualId={ot.estado.id}
              color={ot.tipo.color}
              puedeElegir={esOficina}
              cerrada={cerrada || (s.rol === "mecanico" && ot.ot.mecanicoId !== s.uid)}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mecánico</div>
            {esOficina && !cerrada ? (
              <AsignarMecanico otId={ot.ot.id} actual={ot.ot.mecanicoId} mecanicos={mecs} />
            ) : (
              <div className="text-sm font-medium">{ot.mecanicoNombre ?? "Sin asignar"}</div>
            )}
          </div>
        </div>
      </Tarjeta>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Tarjeta className="p-4">
            <TituloSeccion><span className="inline-flex items-center gap-2"><Wrench className="size-4" /> Trabajo solicitado</span></TituloSeccion>
            <p className="text-sm whitespace-pre-line">{ot.ot.trabajoSolicitado}</p>
            {ot.entrega && (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm">
                <div className="font-semibold text-emerald-900 mb-1">Trabajos realizados</div>
                <p className="whitespace-pre-line">{ot.entrega.trabajosRealizados}</p>
              </div>
            )}
          </Tarjeta>

          {sin?.companiaNombre && (
            <Tarjeta className="p-4 bg-violet-50/40">
              <TituloSeccion><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" /> {ot.tipo.codigo === "renting" ? "Renting / flota" : "Siniestro"}</span></TituloSeccion>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Dato t="Compañía" v={sin.companiaNombre} />
                <Dato t="Nº siniestro / autoriz." v={sin.numeroSiniestro} />
                <Dato t="Póliza / contrato" v={sin.numeroPoliza} />
                <Dato t="Perito" v={sin.perito} />
                <Dato t="Franquicia" v={sin.franquicia != null ? `${sin.franquicia} €` : null} />
                <Dato t="Coche sustitución" v={sin.cubreSustitucion ? "Cubierto" : "No cubierto"} />
              </dl>
            </Tarjeta>
          )}

          <Tarjeta className="p-4">
            <TituloSeccion accion={!cerrada && <NuevaIncidencia otId={ot.ot.id} />}>
              <span className="inline-flex items-center gap-2"><AlertTriangle className="size-4" /> Incidencias</span>
            </TituloSeccion>
            {ot.incidencias.length === 0 && <Vacio>Sin incidencias.</Vacio>}
            <ul className="space-y-2">
              {ot.incidencias.map(({ i, creadaPorNombre }) => {
                const fotos = ot.archivos.filter((a) => a.entidad === "incidencia" && a.entidadId === i.id);
                const abierta = i.estado === "abierta" || i.estado === "en_curso";
                return (
                  <li key={i.id} className={cx("rounded-xl border p-3", abierta ? "border-amber-200 bg-amber-50/40" : "border-slate-200")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{TIPO_INCIDENCIA[i.tipo]}</span>
                      <Pastilla color={COLOR_INC[i.estado]}>{i.estado.replace("_", " ")}</Pastilla>
                      {!i.visibleCliente && <Pastilla color="#475569">Interna</Pastilla>}
                      {i.afectaPrecio && <Pastilla color="#b91c1c">Afecta al precio</Pastilla>}
                      {i.nuevaFecha && <Pastilla color="#1d4ed8">Nueva fecha {fmtFecha(i.nuevaFecha)}</Pastilla>}
                    </div>
                    <p className="text-sm mt-1">{i.descripcion}</p>
                    {fotos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {fotos.map((f) => (
                          <a key={f.id} href={`/api/archivos/${f.id}`} target="_blank">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/archivos/${f.id}`} alt="" className="size-16 rounded-lg object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {i.resolucion && <p className="text-sm text-emerald-800 mt-1">→ {i.resolucion}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-500">{creadaPorNombre} · {fmtFechaHora(i.creadaEn)}</span>
                      {abierta && esOficina && <ResolverIncidencia id={i.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>

          <Tarjeta className="p-4">
            <TituloSeccion><span className="inline-flex items-center gap-2"><ImageIcon className="size-4" /> Fotos</span></TituloSeccion>
            {ot.archivos.length === 0 && <Vacio>Sin fotos.</Vacio>}
            {[
              ["Antes · recepción", fotosAntes],
              ["Durante la reparación", fotosDurante],
              ["Después · entrega", fotosDespues],
            ].map(([titulo, fotos]) =>
              (fotos as typeof ot.archivos).length > 0 ? (
                <div key={titulo as string} className="mb-3">
                  <div className="text-xs font-semibold text-slate-500 mb-1">{titulo as string} ({(fotos as typeof ot.archivos).length})</div>
                  <Galeria ids={(fotos as typeof ot.archivos).map((f) => f.id)} />
                </div>
              ) : null,
            )}
            {!cerrada && <div className="mt-3"><SubirFotos otId={ot.ot.id} /></div>}
          </Tarjeta>
        </div>

        <div className="space-y-5">
          {ot.recepcion && (
            <Tarjeta className="p-4">
              <TituloSeccion>Estado a la entrada</TituloSeccion>
              <div className="space-y-3">
                <VistasDanos danos={ot.recepcion.danos} />
                <dl className="text-sm grid grid-cols-2 gap-2">
                  <Dato t="Kilómetros" v={fmtKm(ot.recepcion.km)} />
                  <Dato t="Combustible" v={fmtCombustible(ot.recepcion.combustible)} />
                  <Dato t="Testigos" v={ot.recepcion.testigos.join(", ") || "Ninguno"} />
                  <Dato t="Objetos" v={ot.recepcion.objetos.join(", ") || "—"} />
                </dl>
                <ol className="text-sm space-y-1">
                  {ot.recepcion.danos.map((d, i) => <li key={i}><b>{i + 1}.</b> {d.tipo} <span className="text-slate-500">· {zonaDano(d)}</span></li>)}
                  {ot.recepcion.danos.length === 0 && <li className="text-slate-500">Sin daños a la entrada.</li>}
                </ol>
              </div>
            </Tarjeta>
          )}

          {ot.prestamos.length > 0 && (
            <Tarjeta className="p-4">
              <TituloSeccion><span className="inline-flex items-center gap-2"><Car className="size-4" /> Coche de sustitución</span></TituloSeccion>
              {ot.prestamos.map(({ p, coche }) => (
                <div key={p.id} className="text-sm space-y-1">
                  <div className="flex items-center gap-2"><Matricula>{coche.matricula}</Matricula> {coche.marca} {coche.modelo}</div>
                  <div className="text-slate-600">{p.conductorNombre} · desde {fmtFechaHora(p.salidaEn)}</div>
                  {p.devueltoEn ? (
                    <div className="text-emerald-700">Devuelto {fmtFechaHora(p.devueltoEn)}</div>
                  ) : (
                    esOficina && <BotonLink variante="secundario" className="mt-2 w-full" href={`/sustitucion/${p.id}/devolucion`}>Registrar devolución</BotonLink>
                  )}
                </div>
              ))}
            </Tarjeta>
          )}

          <Tarjeta className="p-4">
            <TituloSeccion><span className="inline-flex items-center gap-2"><FileText className="size-4" /> Documentos firmados</span></TituloSeccion>
            {ot.documentos.length === 0 && <Vacio>Sin documentos.</Vacio>}
            <ul className="space-y-2">
              {ot.documentos.map((d) => (
                <li key={d.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <a href={`/api/documentos/${d.id}`} target="_blank" className="block hover:text-primary">
                    <div className="text-sm font-semibold">{TIPO_DOCUMENTO[d.tipo]}</div>
                    <div className="text-xs text-slate-500">Firmado por {d.firmanteNombre} · {fmtFechaHora(d.firmadoEn)}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate" title={d.sha256}>SHA-256 {d.sha256}</div>
                  </a>
                  {esOficina && <CompartirDocumento {...docProps(d)} compacto />}
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta className="p-4">
            <TituloSeccion><span className="inline-flex items-center gap-2"><History className="size-4" /> Historial</span></TituloSeccion>
            <ol className="relative border-l-2 border-slate-200 ml-1.5 space-y-3">
              {ot.historial.map((h) => (
                <li key={h.id} className="pl-4 relative">
                  <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-slate-400" />
                  <div className="text-sm font-medium">{h.estado}</div>
                  <div className="text-xs text-slate-500">{fmtFechaHora(h.fecha)} · {h.usuario ?? "—"}</div>
                  {h.comentario && <div className="text-xs text-slate-600">{h.comentario}</div>}
                </li>
              ))}
            </ol>
          </Tarjeta>

          <Link href="/tablero" className="block text-center text-sm text-slate-500 hover:text-slate-800">← Volver al tablero</Link>
        </div>
      </div>
    </div>
  );
}

function Dato({ t, v }: { t: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{t}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}

function Galeria({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {ids.map((id) => (
        <a key={id} href={`/api/archivos/${id}`} target="_blank" className="block aspect-square rounded-xl overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/archivos/${id}`} alt="" loading="lazy" className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}
