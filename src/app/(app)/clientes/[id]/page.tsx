import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, ClipboardList, ClipboardPlus, FileText, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { getCliente } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { enlaceDocumento } from "@/lib/enlaces";
import { telefonoInternacional } from "@/lib/telefono";
import { enlaceWhatsapp, fmtFecha, fmtFechaHora, fmtKm, TIPO_DOCUMENTO } from "@/lib/formato";
import { BotonLink, Matricula, Pastilla, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { CompartirDocumento } from "@/components/compartir-documento";
import { ICONO_TIPO, NOMBRE_TIPO } from "../tipos";
import { EditarCliente } from "./editar";

export const dynamic = "force-dynamic";

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const { id } = await params;
  const data = await getCliente(s.tid, id);
  if (!data) notFound();
  const { cliente: c, esCompania, vehiculos, ordenes, documentos, fotosPorOt } = data;
  const taller = await tallerPorId(s.tid);
  const Icono = ICONO_TIPO[c.tipo];
  const abiertas = ordenes.filter((o) => !o.cerradaEn);
  const otPorId = Object.fromEntries(ordenes.map((o) => [o.id, o]));
  const enlaces = Object.fromEntries(await Promise.all(documentos.map(async (d) => [d.id, await enlaceDocumento(d.id, s.tid)] as const)));
  const wa = c.aceptaWhatsapp ? enlaceWhatsapp(c.telefono, `Hola ${c.nombre.split(" ")[0]}, le escribimos de ${taller.nombre}.`) : null;

  return (
    <div className="space-y-5">
      <Link href="/clientes" className="text-sm text-slate-500">← Clientes</Link>

      <Tarjeta className="p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="size-14 shrink-0 rounded-2xl bg-slate-100 grid place-items-center text-slate-500"><Icono className="size-7" /></div>
          <div className="flex-1 min-w-60">
            <h1 className="text-2xl font-bold">{c.nombre}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              <Pastilla color="#475569">{NOMBRE_TIPO[c.tipo]}</Pastilla>
              {c.exentoIva && <Pastilla color="#0369a1">Exento IVA</Pastilla>}
              {abiertas.length > 0 && <Pastilla color="#c2410c">{abiertas.length} vehículo(s) en taller</Pastilla>}
            </div>
            <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {c.nif && <div><span className="text-slate-500">NIF:</span> <b>{c.nif}</b></div>}
              {c.telefono && <div className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" /><a className="underline" href={`tel:+${telefonoInternacional(c.telefono)}`}>{c.telefono}</a></div>}
              {c.email && <div className="flex items-center gap-1.5"><Mail className="size-4 text-slate-400" /><a className="underline" href={`mailto:${c.email}`}>{c.email}</a></div>}
              {c.direccion && <div className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" />{c.direccion}</div>}
              <div className="text-slate-500">Avisar por: {[c.aceptaLlamada && "llamada", c.aceptaWhatsapp && "WhatsApp", c.aceptaEmail && "email"].filter(Boolean).join(", ") || "no desea avisos"}</div>
              {c.exentoIva && c.motivoExencion && <div className="text-slate-500">Exención: {c.motivoExencion}</div>}
            </dl>
            {c.notas && <p className="mt-3 text-sm rounded-xl bg-amber-50 p-3 whitespace-pre-line">{c.notas}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] text-white px-4 min-h-11 text-sm font-semibold">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
            <EditarCliente c={c} />
          </div>
        </div>
      </Tarjeta>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {!esCompania && (
            <Tarjeta className="p-4">
              <TituloSeccion>Vehículos ({vehiculos.length})</TituloSeccion>
              {vehiculos.length === 0 && <Vacio>Sin vehículos.</Vacio>}
              <div className="grid sm:grid-cols-2 gap-3">
                {vehiculos.map((v) => {
                  const visitas = ordenes.filter((o) => o.vehiculoId === v.id);
                  const enTaller = visitas.find((o) => !o.cerradaEn);
                  return (
                    <div key={v.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {v.marca && <LogoMarca marca={v.marca} className="size-8" />}
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{v.marca} {v.modelo}</div>
                          <Matricula>{v.matricula}</Matricula>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {[v.anio, v.combustible, v.color].filter(Boolean).join(" · ")}
                        {v.kmUltimo != null && <> · {fmtKm(v.kmUltimo)}</>}
                        {v.bastidor && <div className="font-mono">VIN {v.bastidor}</div>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600">{visitas.length} visita(s)</span>
                        {enTaller ? (
                          <Link href={`/ot/${enTaller.id}`} className="text-xs font-semibold text-primary">En taller: {enTaller.estadoNombre} →</Link>
                        ) : (
                          <BotonLink variante="secundario" className="min-h-9 px-3 text-xs" href={`/recepcion/nueva?matricula=${encodeURIComponent(v.matricula)}`}>
                            <ClipboardPlus className="size-4" /> Nueva recepción
                          </BotonLink>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Tarjeta>
          )}

          <Tarjeta className="p-4">
            <TituloSeccion>
              <span className="inline-flex items-center gap-2"><ClipboardList className="size-4" /> {esCompania ? "Órdenes de esta compañía" : "Historial de órdenes"} ({ordenes.length})</span>
            </TituloSeccion>
            {ordenes.length === 0 && <Vacio>Sin órdenes todavía.</Vacio>}
            <ul className="divide-y divide-slate-100">
              {ordenes.map((o) => (
                <li key={o.id}>
                  <Link href={`/ot/${o.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-xl">
                    <span className="w-1 self-stretch rounded-full" style={{ background: o.tipoColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">{o.numero}</span>
                        <Matricula>{o.matricula}</Matricula>
                        <span className="text-sm font-medium truncate">{o.marca} {o.modelo}</span>
                        {esCompania && o.clienteId !== c.id && <span className="text-xs text-slate-500">· {o.clienteNombre}</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{o.trabajo}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Pastilla color={o.tipoColor}>{o.tipoNombre}</Pastilla>
                        {o.cerradaEn ? <Pastilla color="#059669">Entregado {fmtFecha(o.cerradaEn)}</Pastilla> : <Pastilla color="#c2410c">{o.estadoNombre}</Pastilla>}
                        {o.datosSiniestro?.numeroSiniestro && <span className="text-[11px] text-slate-500 inline-flex items-center gap-1"><ShieldCheck className="size-3.5" />{o.datosSiniestro.numeroSiniestro}</span>}
                        {fotosPorOt[o.id] > 0 && <span className="text-[11px] text-slate-500 inline-flex items-center gap-1"><Camera className="size-3.5" />{fotosPorOt[o.id]}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 text-right shrink-0">{fmtFecha(o.fechaEntrada)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>

        <Tarjeta className="p-4 self-start">
          <TituloSeccion><span className="inline-flex items-center gap-2"><FileText className="size-4" /> Documentos ({documentos.length})</span></TituloSeccion>
          {documentos.length === 0 && <Vacio>Sin documentos firmados.</Vacio>}
          <ul className="space-y-2">
            {documentos.map((d) => {
              const o = d.otId ? otPorId[d.otId] : null;
              return (
                <li key={d.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <a href={`/api/documentos/${d.id}`} target="_blank" className="block hover:text-primary">
                    <div className="text-sm font-semibold">{TIPO_DOCUMENTO[d.tipo]}</div>
                    <div className="text-xs text-slate-500">
                      {o && <>{o.matricula} · {o.numero} · </>}
                      {fmtFechaHora(d.firmadoEn)}
                    </div>
                  </a>
                  {!esCompania && (
                    <CompartirDocumento
                      compacto
                      docId={d.id}
                      enlace={enlaces[d.id]}
                      telefono={c.telefono}
                      mensaje={`Hola ${c.nombre.split(" ")[0]}, le enviamos desde ${taller.nombre} su ${TIPO_DOCUMENTO[d.tipo]?.toLowerCase()}${o ? ` del vehículo ${o.matricula} (orden ${o.numero})` : ""}.`}
                      nombreFichero={`${TIPO_DOCUMENTO[d.tipo]}${o ? ` ${o.matricula.replace(/\s/g, "")} ${o.numero}` : ""}.pdf`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
