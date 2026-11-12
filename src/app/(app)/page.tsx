import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CalendarDays, Car, CheckCircle2, ClipboardPlus, Clock, Hourglass,
  Phone, Receipt, ShieldCheck, UserX, Wallet, Wrench,
  ClipboardCheck,
} from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { actividadSemana, citasDelDia, entregadosRecientes, flotaSustitucion, incidenciasAbiertas, listarOTsAbiertas, mecanicos, pendientesCobro } from "@/lib/data";
import { fmtEuros } from "@/lib/importes";
import { tallerPorId } from "@/lib/taller";
import { nombresPuestos, tiene, type Puesto } from "@/lib/puestos";
import { cuando } from "@/lib/citas";
import { esperaAprobacionOPerito, esRetrasada } from "@/lib/ots";
import { mensajeListo } from "@/lib/mensajes";
import { AvisoListo } from "@/components/aviso-listo";
import { diaISO, enlaceWhatsapp, fmtFecha, fmtFechaHora, TIPO_INCIDENCIA, ZONA } from "@/lib/formato";
import { BotonLink, Matricula, Pastilla, Tarjeta, TituloSeccion, Vacio, cx } from "@/components/ui";
import { OtTarjeta } from "@/components/ot-tarjeta";
import { BuscadorGlobal } from "@/components/buscador-global";
import { AutoRefresco } from "@/components/auto-refresco";

export const dynamic = "force-dynamic";

/*
 * Inicio de oficina. Cada bloque está ligado a uno o varios puestos; una persona ve la suma de los suyos
 * (p. ej. recepción + teléfono + facturación), sin duplicados y en un orden fijo.
 */
const ve = (puestos: Puesto[], ...para: Puesto[]) => puestos.some((p) => para.includes(p));

export default async function Inicio() {
  const s = await requireSesion("oficina");
  const P = s.puestos;

  const [ots, citas, flota, taller, semana, entregados, incidencias, mecs, porCobrar] = await Promise.all([
    listarOTsAbiertas(s.tid),
    ve(P, "recepcion", "direccion", "telefono") ? citasDelDia(s.tid) : Promise.resolve([]),
    flotaSustitucion(s.tid),
    tallerPorId(s.tid),
    ve(P, "direccion") ? actividadSemana(s.tid) : Promise.resolve(null),
    ve(P, "facturacion", "direccion") ? entregadosRecientes(s.tid, 7) : Promise.resolve([]),
    ve(P, "jefe_taller", "direccion") ? incidenciasAbiertas(s.tid) : Promise.resolve([]),
    ve(P, "jefe_taller", "direccion") ? mecanicos(s.tid) : Promise.resolve([]),
    ve(P, "facturacion", "direccion", "recepcion") ? pendientesCobro(s.tid) : Promise.resolve([]),
  ]);

  const listos = ots.filter((o) => o.estadoMarca === "listo");
  const citasHoy = citas.filter(({ c }) => c.estado !== "anulada");
  const retrasados = ots.filter(esRetrasada);
  const esperando = ots.filter(esperaAprobacionOPerito);
  const sinAsignar = ots.filter((o) => !o.mecanicoId && o.estadoMarca !== "listo");
  const prestados = flota.filter((c) => c.estado === "prestado").length;
  const en30 = diaISO(new Date(Date.now() + 30 * 86400_000));
  const alertasFlota = flota.filter((c) => (c.itvHasta && c.itvHasta < en30) || (c.seguroHasta && c.seguroHasta < en30));

  // Clientes a llamar: retrasados (avisar del nuevo plazo) y pendientes de su aprobación
  const aLlamar = [
    ...ots.filter((o) => o.requiereAprobacion && !o.datosSiniestro?.companiaNombre).map((o) => ({ o, motivo: "Confirmar presupuesto", color: "#7c3aed" })),
    ...ots.filter((o) => o.ampliacionPendiente).map((o) => ({ o, motivo: "* Confirmar ampliación", color: "#b45309" })),
    ...retrasados.map((o) => ({ o, motivo: `Retrasado (prevista ${fmtFecha(o.fechaPrevista)})`, color: "#b91c1c" })),
  ].filter((x, i, arr) => arr.findIndex((y) => y.o.id === x.o.id) === i);

  const kpis: { t: string; v: string | number; i: typeof Car; c: string; href?: string }[] = [
    { t: "En taller", v: ots.length, i: Car, c: "text-slate-700", href: "/tablero" },
    { t: "Listos para entregar", v: listos.length, i: CheckCircle2, c: "text-emerald-700", href: "/tablero?filtro=listos" },
    { t: "Retrasados", v: retrasados.length, i: Clock, c: retrasados.length ? "text-red-700" : "text-slate-700", href: "/tablero?filtro=retrasados" },
    { t: "Esperando aprobación o perito", v: esperando.length, i: Hourglass, c: "text-violet-700", href: "/tablero?filtro=espera" },
  ];
  if (semana)
    kpis.push(
      { t: "Entradas esta semana", v: semana.entradas, i: ArrowDownToLine, c: "text-slate-700" },
      { t: "Entregados esta semana", v: semana.salidas, i: ArrowUpFromLine, c: "text-slate-700" },
      { t: "Coches de sustitución en uso", v: `${prestados}/${flota.length}`, i: Car, c: "text-slate-700", href: "/sustitucion" },
      { t: "Incidencias abiertas", v: incidencias.length, i: AlertTriangle, c: incidencias.length ? "text-amber-700" : "text-slate-700", href: "/tablero?filtro=incidencias" },
    );

  // ── Bloques de la columna principal ──
  const principal: ReactNode[] = [];

  if (ve(P, "recepcion", "telefono"))
    principal.push(
      <Bloque key="listos" titulo="Listos para entregar" icono={CheckCircle2} n={listos.length}>
        {listos.length === 0 ? (
          <Tarjeta><Vacio>Ningún vehículo listo todavía.</Vacio></Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-slate-100">
            {listos.map((o) => {
              const wa = enlaceWhatsapp(o.clienteTelefono, mensajeListo(taller, o));
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3 p-3">
                  <Matricula>{o.matricula}</Matricula>
                  <Link href={`/ot/${o.id}`} className="min-w-40 flex-1 hover:underline">
                    <div className="text-sm font-semibold">{o.marca} {o.modelo}</div>
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
                  {tiene(P, "recepcion") && <BotonLink href={`/ot/${o.id}/entrega`} variante="exito" className="min-h-10">Entregar</BotonLink>}
                </div>
              );
            })}
          </Tarjeta>
        )}
      </Bloque>,
    );

  if (ve(P, "telefono", "recepcion", "direccion"))
    principal.push(
      <Bloque key="llamar" titulo="Clientes a llamar" icono={Phone} n={aLlamar.length} ayuda="Retrasados, presupuestos y ampliaciones sin confirmar. Llamar antes de que llamen ellos.">
        {aLlamar.length === 0 ? (
          <Tarjeta><Vacio>Nadie pendiente de llamar. 👍</Vacio></Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-slate-100">
            {aLlamar.map(({ o, motivo, color }) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 p-3">
                <Matricula>{o.matricula}</Matricula>
                <Link href={`/ot/${o.id}`} className="min-w-40 flex-1 hover:underline">
                  <div className="text-sm font-semibold">{o.clienteNombre}</div>
                  <div className="text-xs text-slate-500">{o.marca} {o.modelo} · {o.estadoNombre}</div>
                </Link>
                <Pastilla color={color}>{motivo}</Pastilla>
                {o.clienteTelefono && (
                  <a href={`tel:${o.clienteTelefono.replace(/\s/g, "")}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 tabular-nums">
                    <Phone className="size-4" aria-hidden /> {o.clienteTelefono}
                  </a>
                )}
              </div>
            ))}
          </Tarjeta>
        )}
      </Bloque>,
    );

  // Peritajes del día (lista del perito): solo si hay alguno
  const hoyD = diaISO();
  const peritajesHoy = tiene(P, "peritajes")
    ? ots.filter((o) => o.datosSiniestro?.fechaPeritaje && o.datosSiniestro.fechaPeritaje <= hoyD && !o.requiereAprobacion && /perit|recep/i.test(o.estadoNombre))
    : [];
  if (peritajesHoy.length > 0)
    principal.push(
      <Bloque key="peritajes" titulo="Peritajes para hoy" icono={ClipboardCheck} n={peritajesHoy.length} accion={<Link href="/peritajes" className="text-sm font-semibold text-slate-700 hover:underline">Lista del perito</Link>}>
        <Tarjeta className="divide-y divide-slate-100">
          {peritajesHoy.map((o) => (
            <Link key={o.id} href={`/ot/${o.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-slate-50">
              <Matricula>{o.matricula}</Matricula>
              <div className="min-w-40 flex-1">
                <div className="text-sm font-semibold">{o.marca} {o.modelo}</div>
                <div className="text-xs text-slate-500">{o.datosSiniestro?.companiaNombre ?? "Sin compañía"}{o.datosSiniestro?.perito ? ` · ${o.datosSiniestro.perito}` : ""}</div>
              </div>
              {o.datosSiniestro!.fechaPeritaje! < hoyD && <Pastilla color="#b91c1c">Era el {fmtFecha(o.datosSiniestro!.fechaPeritaje!)}</Pastilla>}
            </Link>
          ))}
        </Tarjeta>
      </Bloque>,
    );

  if (ve(P, "jefe_taller", "direccion"))
    principal.push(
      <Bloque key="sinasignar" titulo="Sin mecánico asignado" icono={UserX} n={sinAsignar.length} accion={<Link href="/tablero" className="text-sm font-semibold text-slate-700 hover:underline">Ir al tablero</Link>}>
        {sinAsignar.length === 0 ? (
          <Tarjeta><Vacio>Todo el trabajo está repartido.</Vacio></Tarjeta>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{sinAsignar.map((o) => <OtTarjeta key={o.id} ot={o} />)}</div>
        )}
      </Bloque>,
      <Bloque key="bloqueados" titulo="Parados esperando a terceros" icono={Hourglass} n={esperando.length} ayuda="Aprobación del cliente, perito o autorización de la compañía.">
        {esperando.length === 0 ? (
          <Tarjeta><Vacio>Nada parado.</Vacio></Tarjeta>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{esperando.map((o) => <OtTarjeta key={o.id} ot={o} />)}</div>
        )}
      </Bloque>,
    );

  if (ve(P, "facturacion", "direccion", "recepcion") && porCobrar.length > 0)
    principal.push(
      <Bloque key="porcobrar" titulo="Pendiente de cobro" icono={Wallet} n={porCobrar.length} ayuda={`Total pendiente: ${fmtEuros(porCobrar.reduce((s2, f) => s2 + f.pendienteCliente + f.pendienteCompania, 0))}`}>
        <Tarjeta className="divide-y divide-slate-100">
          {porCobrar.map((f) => (
            <Link key={f.otId} href={`/ot/${f.otId}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-slate-50">
              <Matricula>{f.matricula}</Matricula>
              <div className="min-w-40 flex-1 text-sm">
                <div className="font-semibold">{f.clienteNombre} <span className="font-mono text-xs font-normal text-slate-400">{f.numero}</span></div>
                <div className="text-xs text-slate-500">{f.cerradaEn ? `Entregado ${fmtFechaHora(f.cerradaEn)}` : "En taller"} · total {fmtEuros(f.total)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.pendienteCliente > 0 && <Pastilla color="#b45309">Cliente {fmtEuros(f.pendienteCliente)}</Pastilla>}
                {f.pendienteCompania > 0 && <Pastilla color="#7c3aed">{f.reparto.companiaNombre} {fmtEuros(f.pendienteCompania)}</Pastilla>}
              </div>
            </Link>
          ))}
        </Tarjeta>
      </Bloque>,
    );

  if (ve(P, "facturacion", "direccion"))
    principal.push(
      <Bloque key="entregados" titulo="Entregados (últimos 7 días)" icono={Receipt} n={entregados.length} ayuda="Para pasar al programa de facturación; apunta allí el nº de factura en cada orden.">
        {entregados.length === 0 ? (
          <Tarjeta><Vacio>No se ha entregado ningún vehículo esta semana.</Vacio></Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-slate-100">
            {entregados.map((o) => (
              <Link key={o.id} href={`/ot/${o.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-slate-50">
                <Matricula>{o.matricula}</Matricula>
                <div className="min-w-40 flex-1 text-sm">
                  <div className="font-semibold">{o.clienteNombre} <span className="font-mono text-xs font-normal text-slate-400">{o.numero}</span></div>
                  <div className="text-xs text-slate-500">{o.tipoNombre} · {fmtFechaHora(o.cerradaEn)}</div>
                </div>
                {o.datosSiniestro?.companiaNombre && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600"><ShieldCheck className="size-3.5" aria-hidden /> Paga {o.datosSiniestro.companiaNombre}</span>
                )}
                {o.clienteExento && <Pastilla color="#0f766e">Exento de IVA</Pastilla>}
                {o.total != null && <span className="text-sm font-semibold tabular-nums">{fmtEuros(o.total)}</span>}
                {o.total != null && (o.facturaExterna ? <Pastilla color="#047857">Factura {o.facturaExterna}</Pastilla> : <Pastilla color="#64748b">Sin nº de factura</Pastilla>)}
              </Link>
            ))}
          </Tarjeta>
        )}
      </Bloque>,
    );

  // ── Columna lateral ──
  const lateral: ReactNode[] = [];

  if (ve(P, "recepcion", "direccion", "telefono"))
    lateral.push(
      <Bloque key="citas" titulo="Citas de hoy" icono={CalendarDays} n={citasHoy.length} accion={tiene(P, "citas") ? <Link href="/agenda" className="text-sm font-semibold text-slate-600 hover:underline">Agenda →</Link> : undefined}>
        <Tarjeta className="divide-y divide-slate-100">
          {citasHoy.length === 0 && <Vacio>Sin citas hoy.</Vacio>}
          {citasHoy.map(({ c, tipoNombre, tipoColor }) => (
            <div key={c.id} className={cx("flex items-center gap-3 p-3", c.estado === "no_vino" && "opacity-60")}>
              <div className="w-20 shrink-0 text-sm font-bold first-letter:uppercase">{cuando(c)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.contacto}</div>
                <div className="truncate text-xs text-slate-500">{c.motivo}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {c.matricula && <Matricula>{c.matricula}</Matricula>}
                  {tipoNombre && <Pastilla color={tipoColor ?? undefined}>{tipoNombre}</Pastilla>}
                </div>
              </div>
              {c.otId ? (
                <Link className="text-xs font-semibold text-emerald-700" href={`/ot/${c.otId}`}>Recibido</Link>
              ) : c.estado === "no_vino" ? (
                <span className="text-xs font-semibold text-red-700">No vino</span>
              ) : (
                tiene(P, "recepcion") && <BotonLink variante="secundario" className="min-h-10 px-3 text-sm" href={`/recepcion/nueva?cita=${c.id}`}>Recibir</BotonLink>
              )}
            </div>
          ))}
        </Tarjeta>
      </Bloque>,
    );

  if (ve(P, "jefe_taller", "direccion")) {
    const carga = mecs.map((m) => ({ ...m, n: ots.filter((o) => o.mecanicoId === m.id && o.estadoMarca !== "listo").length }));
    const max = Math.max(1, ...carga.map((c) => c.n));
    lateral.push(
      <Bloque key="carga" titulo="Carga por mecánico" icono={Wrench}>
        <Tarjeta className="space-y-3 p-4">
          {carga.length === 0 && <Vacio>No hay mecánicos dados de alta.</Vacio>}
          {carga.map((m) => (
            <div key={m.id}>
              <div className="flex justify-between text-sm"><span className="font-medium">{m.nombre}</span><span className="tabular-nums text-slate-600">{m.n}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
                <div className="h-full rounded-full" style={{ width: `${(m.n / max) * 100}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </Tarjeta>
      </Bloque>,
      <Bloque key="incidencias" titulo="Incidencias abiertas" icono={AlertTriangle} n={incidencias.length}>
        <Tarjeta className="divide-y divide-slate-100">
          {incidencias.length === 0 && <Vacio>Sin incidencias abiertas.</Vacio>}
          {incidencias.slice(0, 8).map((i) => (
            <Link key={i.id} href={`/ot/${i.otId}`} className="block p-3 hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <Matricula>{i.matricula}</Matricula>
                <span className={cx("text-xs font-semibold", i.tipo === "dano_taller" ? "text-red-700" : "text-amber-700")}>{TIPO_INCIDENCIA[i.tipo] ?? i.tipo}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{i.descripcion}</p>
            </Link>
          ))}
        </Tarjeta>
      </Bloque>,
    );
  }

  if (ve(P, "recepcion", "direccion", "telefono"))
    lateral.push(
      <Bloque key="flota" titulo="Coches de sustitución" icono={Car} accion={<Link href="/sustitucion" className="text-sm font-semibold text-slate-700 hover:underline">Ver flota</Link>}>
        <Tarjeta className="space-y-2 p-4 text-sm">
          <div><span className="text-2xl font-bold tabular-nums">{flota.length - prestados}</span> de {flota.length} disponibles</div>
          {alertasFlota.map((c) => (
            <p key={c.id} className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> {c.matricula}: revisa ITV o seguro
            </p>
          ))}
        </Tarjeta>
      </Bloque>,
    );

  return (
    <div className="space-y-6">
      <AutoRefresco segundos={60} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hola, {s.nombre}</h1>
          <p className="text-sm text-slate-500">
            {fechaLarga()} · {nombresPuestos(P)}
          </p>
        </div>
        {tiene(P, "recepcion") && (
          <BotonLink href="/recepcion/nueva" className="min-h-12 px-5 text-base">
            <ClipboardPlus className="size-5" aria-hidden /> Nueva recepción
          </BotonLink>
        )}
      </div>

      <BuscadorGlobal grande={P.includes("telefono")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ t, v, i: I, c, href }) => {
          const contenido = (
            <>
              <I className={cx("size-5", c)} aria-hidden />
              <div className="mt-2 text-3xl font-bold tabular-nums">{v}</div>
              <div className="text-xs text-slate-500">{t}</div>
            </>
          );
          return href ? (
            <Link key={t} href={href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow">{contenido}</Link>
          ) : (
            <Tarjeta key={t} className="p-4">{contenido}</Tarjeta>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="min-w-0 space-y-6 lg:col-span-2">{principal}</section>
        <aside className="min-w-0 space-y-6">{lateral}</aside>
      </div>
    </div>
  );
}

function fechaLarga() {
  const f = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function Bloque({ titulo, icono: I, n, ayuda, accion, children }: { titulo: string; icono: typeof Car; n?: number; ayuda?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <TituloSeccion accion={accion}>
        <span className="inline-flex items-center gap-2">
          <I className="size-4 text-slate-500" aria-hidden /> {titulo}
          {n !== undefined && n > 0 && <span className="rounded-full bg-slate-200 px-2 text-xs font-semibold tabular-nums text-slate-700">{n}</span>}
        </span>
      </TituloSeccion>
      {ayuda && <p className="-mt-2 mb-3 text-xs text-slate-500">{ayuda}</p>}
      {children}
    </div>
  );
}

