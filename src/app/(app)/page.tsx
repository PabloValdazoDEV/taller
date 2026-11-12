import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarX2, Car, CheckCircle2, ClipboardPlus, Hourglass, KeyRound } from "lucide-react";
import { AvisoListo } from "@/components/aviso-listo";
import { esperaAprobacionOPerito, esRetrasada } from "@/lib/ots";
import { mensajeListo } from "@/lib/mensajes";
import { requireSesion } from "@/lib/auth";
import { citasDelDia, flotaSustitucion, listarOTsAbiertas } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { BotonLink, Matricula, Pastilla, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { OtTarjeta } from "@/components/ot-tarjeta";
import { enlaceWhatsapp, fmtHora, ZONA } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const [ots, citas, flota, taller] = await Promise.all([listarOTsAbiertas(s.tid), citasDelDia(s.tid), flotaSustitucion(s.tid), tallerPorId(s.tid)]);

  const listos = ots.filter((o) => o.estadoMarca === "listo");
  const pendientes = ots.filter(esperaAprobacionOPerito);
  const conIncidencias = ots.filter((o) => o.incidenciasAbiertas > 0);
  const retrasados = ots.filter(esRetrasada);
  const disponibles = flota.filter((c) => c.estado === "disponible").length;
  const prestados = flota.filter((c) => c.estado === "prestado").length;

  // Cada indicador lleva a la lista filtrada
  const kpis = [
    { t: "En taller", v: ots.length, i: Car, c: "text-slate-700", href: "/tablero" },
    { t: "Listos para entregar", v: listos.length, i: CheckCircle2, c: "text-emerald-600", href: "/tablero?filtro=listos" },
    { t: "Aprobación / perito", v: pendientes.length, i: Hourglass, c: "text-violet-600", href: "/tablero?filtro=espera" },
    { t: "Con incidencias", v: conIncidencias.length, i: AlertTriangle, c: "text-amber-600", href: "/tablero?filtro=incidencias" },
    { t: "Retrasados", v: retrasados.length, i: CalendarX2, c: retrasados.length ? "text-red-600" : "text-slate-400", href: "/tablero?filtro=retrasados" },
    { t: "Coches sustitución fuera", v: prestados, i: KeyRound, c: "text-sky-600", href: "/sustitucion" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hola, {s.nombre}</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA })}</p>
        </div>
        <BotonLink href="/recepcion/nueva" className="text-base px-5 min-h-12">
          <ClipboardPlus className="size-5" /> Nueva recepción
        </BotonLink>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(({ t, v, i: I, c, href }) => (
          <Link key={t} href={href} className="block rounded-2xl bg-white border border-slate-200 shadow-sm p-4 hover:border-primary hover:shadow transition">
            <I className={`size-5 ${c}`} />
            <div className="text-3xl font-bold mt-2 tabular-nums">{v}</div>
            <div className="text-xs text-slate-500">{t}</div>
          </Link>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 space-y-6">
          <div>
            <TituloSeccion>Listos para entregar</TituloSeccion>
            {listos.length === 0 ? (
              <Tarjeta><Vacio>Ningún vehículo listo todavía.</Vacio></Tarjeta>
            ) : (
              <div className="space-y-2">
                {listos.map((o) => {
                  const wa = enlaceWhatsapp(o.clienteTelefono, mensajeListo(taller, o));
                  return (
                    <Tarjeta key={o.id} className="p-3 flex flex-wrap items-center gap-3">
                      <Matricula>{o.matricula}</Matricula>
                      <Link href={`/ot/${o.id}`} className="flex-1 min-w-40">
                        <div className="font-semibold text-sm">{o.marca} {o.modelo}</div>
                        <div className="text-xs text-slate-500">{o.clienteNombre}</div>
                      </Link>
                      <AvisoListo
                        otId={o.id}
                        enlaceWa={wa}
                        telefono={o.clienteTelefono}
                        aceptaWhatsapp={o.clienteAceptaWhatsapp}
                        aceptaLlamada={o.clienteAceptaLlamada}
                        avisadoEn={o.avisadoListoEn}
                      />
                      <BotonLink href={`/ot/${o.id}/entrega`} variante="exito" className="min-h-11">Entregar</BotonLink>
                    </Tarjeta>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <TituloSeccion>Pendientes de aprobación / peritaje</TituloSeccion>
            {pendientes.length === 0 ? (
              <Tarjeta><Vacio>Nada pendiente.</Vacio></Tarjeta>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">{pendientes.map((o) => <OtTarjeta key={o.id} ot={o} />)}</div>
            )}
          </div>

          {conIncidencias.length > 0 && (
            <div>
              <TituloSeccion>Con incidencias abiertas</TituloSeccion>
              <div className="grid sm:grid-cols-2 gap-3">{conIncidencias.map((o) => <OtTarjeta key={o.id} ot={o} />)}</div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div>
            <TituloSeccion><span className="inline-flex items-center gap-2"><CalendarDays className="size-4" /> Citas de hoy</span></TituloSeccion>
            <Tarjeta className="divide-y divide-slate-100">
              {citas.length === 0 && <Vacio>Sin citas hoy.</Vacio>}
              {citas.map(({ c, tipoNombre, tipoColor }) => (
                <div key={c.id} className="p-3 flex items-center gap-3">
                  <div className="text-sm font-bold tabular-nums w-12">{fmtHora(c.fechaHora)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{c.contacto}</div>
                    <div className="text-xs text-slate-500 truncate">{c.motivo}</div>
                    <div className="mt-1 flex gap-2 items-center">
                      {c.matricula && <Matricula>{c.matricula}</Matricula>}
                      {tipoNombre && <Pastilla color={tipoColor ?? undefined}>{tipoNombre}</Pastilla>}
                    </div>
                  </div>
                  {c.otId ? (
                    <Link className="text-xs text-emerald-700 font-semibold" href={`/ot/${c.otId}`}>Recibido</Link>
                  ) : (
                    <BotonLink variante="secundario" className="min-h-9 px-3 text-xs" href={`/recepcion/nueva?cita=${c.id}`}>Recibir</BotonLink>
                  )}
                </div>
              ))}
            </Tarjeta>
          </div>

          <div>
            <TituloSeccion accion={<Link href="/sustitucion" className="text-xs text-primary font-semibold">Ver flota</Link>}>
              Coches de sustitución
            </TituloSeccion>
            <Tarjeta className="p-4 text-sm">
              <span className="text-2xl font-bold">{disponibles}</span> de {flota.length} disponibles
              {prestados > 0 && <span className="text-slate-500"> · {prestados} prestado(s)</span>}
            </Tarjeta>
          </div>
        </aside>
      </div>
    </div>
  );
}
