import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { requireSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { citasDelDia, citasEntre, citasPorDia, tiposConEstados } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { diaISO, enlaceWhatsapp, fmtHora } from "@/lib/formato";
import { cuando, diaCorto, textoCita } from "@/lib/citas";
import { hayHoras, horasTipo, limpiarHoras, sumarDias as sumar, textoHoras } from "@/lib/capacidad";
import { cargaDias } from "@/lib/carga";
import { BotonLink, Matricula, Pastilla, Tarjeta, Vacio, cx } from "@/components/ui";
import { AccionesCita, NuevaCita, type CitaEditable, type Tipo } from "./cliente";
import { CargaDelDia, PUNTO } from "./carga";
import { SelectorVista, VistaMes, VistaSemana, type CitaVista } from "./vistas";

export const dynamic = "force-dynamic";

const LETRA = ["L", "M", "X", "J", "V", "S", "D"];

export default async function Agenda({ searchParams }: { searchParams: Promise<{ dia?: string; nueva?: string; matricula?: string; vista?: string }> }) {
  const s = await requireSesion("citas");
  const sp = await searchParams;
  const hoy = diaISO();
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && !Number.isNaN(Date.parse(sp.dia)) ? sp.dia : hoy;
  const lunes = sumar(dia, -((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7));
  const vista = sp.vista === "semana" || sp.vista === "mes" ? sp.vista : "dia";

  if (vista !== "dia") {
    // Semana: de lunes a domingo. Mes: el calendario entero (de lunes a domingo, aunque asome del mes de al lado)
    const primero = `${dia.slice(0, 7)}-01`;
    const desde = vista === "semana" ? lunes : sumar(primero, -((new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7));
    const finMes = sumar(sumar(primero, 32).slice(0, 7) + "-01", -1);
    const hasta = vista === "semana" ? sumar(lunes, 6) : sumar(finMes, 6 - ((new Date(`${finMes}T12:00:00Z`).getUTCDay() + 6) % 7));
    const [lista, tiposFlujo, taller, carga] = await Promise.all([citasEntre(s.tid, desde, sumar(hasta, 1)), tiposConEstados(s.tid), tallerPorId(s.tid), cargaDias(s.tid, desde, hasta)]);
    const tipos: Tipo[] = tiposFlujo.map((t) => ({ id: t.id, nombre: t.nombre, horas: horasTipo(taller.config, t) }));
    const citasV: CitaVista[] = lista.map((x) => ({
      ...x,
      porValorar: !hayHoras(limpiarHoras(x.c.horas)) && !hayHoras(horasTipo(taller.config, tiposFlujo.find((t) => t.id === x.c.tipoOrdenId))),
    }));
    return (
      <div className={cx("mx-auto space-y-4", vista === "mes" ? "max-w-5xl" : "max-w-3xl")}>
        <Cabecera dia={dia} vista={vista} nueva={<NuevaCita dia={dia} tipos={tipos} abrir={sp.nueva === "1"} matricula={sp.matricula ?? ""} />} />
        {vista === "semana" ? <VistaSemana lunes={lunes} hoy={hoy} citas={citasV} carga={carga} /> : <VistaMes dia={dia} hoy={hoy} citas={citasV} carga={carga} />}
      </div>
    );
  }

  const [citas, cuenta, tiposFlujo, taller, carga] = await Promise.all([
    citasDelDia(s.tid, dia),
    citasPorDia(s.tid, lunes, sumar(lunes, 7)),
    tiposConEstados(s.tid),
    tallerPorId(s.tid),
    cargaDias(s.tid, lunes, sumar(lunes, 6)),
  ]);
  const tipos: Tipo[] = tiposFlujo.map((t) => ({ id: t.id, nombre: t.nombre, horas: horasTipo(taller.config, t) }));
  const recibe = tiene(s.puestos, "recepcion");
  const activas = citas.filter(({ c }) => c.estado !== "anulada");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Cabecera dia={dia} vista="dia" nueva={<NuevaCita dia={dia} tipos={tipos} abrir={sp.nueva === "1"} matricula={sp.matricula ?? ""} />} />

      {/* Semana */}
      <Tarjeta className="p-2">
        <div className="flex items-center gap-1">
          <Link href={`/agenda?dia=${sumar(dia, -7)}`} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Semana anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="grid flex-1 grid-cols-7 gap-1">
            {LETRA.map((l, i) => {
              const d = sumar(lunes, i);
              const n = cuenta[d] ?? 0;
              const nivel = carga[d]?.nivel;
              return (
                <Link
                  key={d}
                  href={`/agenda?dia=${d}`}
                  aria-current={d === dia ? "date" : undefined}
                  className={cx(
                    "flex flex-col items-center rounded-lg py-1.5 text-xs",
                    d === dia ? "bg-slate-900 text-white" : d === hoy ? "bg-slate-100 font-semibold" : "hover:bg-slate-50",
                    d < hoy && d !== dia && "text-slate-400",
                  )}
                >
                  <span className="flex items-center gap-1">
                    {l}
                    {nivel && <span className={cx("size-2 rounded-full", PUNTO[nivel].clase)} title={PUNTO[nivel].texto} aria-label={PUNTO[nivel].texto} />}
                  </span>
                  <span className="text-base font-bold tabular-nums">{Number(d.slice(8))}</span>
                  <span className={cx("h-4 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 tabular-nums", n ? (d === dia ? "bg-white text-slate-900" : "bg-amber-100 text-amber-900") : "")}>{n || ""}</span>
                </Link>
              );
            })}
          </div>
          <Link href={`/agenda?dia=${sumar(dia, 7)}`} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Semana siguiente">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
      </Tarjeta>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold first-letter:uppercase">{diaCorto(`${dia}T12:00:00Z`)}{dia === hoy || dia === sumar(hoy, 1) ? ` · ${diaCorto(`${dia}T12:00:00Z`, false)}` : ""}</h2>
        <span className="text-sm text-slate-500">{activas.length} cita(s)</span>
        <span className="ml-auto flex gap-2">
          {dia !== hoy && <BotonLink variante="fantasma" className="min-h-10 px-3" href="/agenda">Hoy</BotonLink>}
          <form action="/agenda" className="flex items-center">
            <label className="sr-only" htmlFor="ir-dia">Ir al día</label>
            <input id="ir-dia" type="date" name="dia" defaultValue={dia} className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 text-sm" />
            <button type="submit" className="ml-1 min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Ir</button>
          </form>
        </span>
      </div>

      {carga[dia] && <CargaDelDia c={carga[dia]} />}

      {citas.length === 0 ? (
        <Tarjeta><Vacio>No hay citas este día.</Vacio></Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-slate-100">
          {citas.map(({ c, tipoNombre, tipoColor, aceptaWhatsapp, vehiculo, creadoPorNombre }) => {
            const recibida = !!c.otId;
            const mensaje = `Hola ${c.contacto.split(" ")[0]}, le confirmamos su cita en ${taller.nombre} ${textoCita(c)}${c.matricula ? ` para su vehículo ${c.matricula}` : ""}.${taller.direccion ? ` Estamos en ${taller.direccion}.` : ""}${taller.telefono ? ` Si necesita cambiarla, llámenos al ${taller.telefono}.` : ""}`;
            const wa = c.estado === "pendiente" && !recibida && (c.clienteId ? aceptaWhatsapp : true) ? enlaceWhatsapp(c.telefono, mensaje) : null;
            const editable: CitaEditable = {
              id: c.id, contacto: c.contacto, telefono: c.telefono, matricula: c.matricula, dia: diaISO(c.fechaHora),
              franja: c.franja ?? "hora", hora: c.franja ? "" : fmtHora(c.fechaHora), tipoOrdenId: c.tipoOrdenId, motivo: c.motivo, nota: c.nota,
              horas: limpiarHoras(c.horas), necesitaSustitucion: c.necesitaSustitucion,
            };
            // Las suyas o, si no tiene, las de su tipo; si tampoco, «por valorar»
            const propias = limpiarHoras(c.horas);
            const horasCita = textoHoras(hayHoras(propias) ? propias : horasTipo(taller.config, tiposFlujo.find((x) => x.id === c.tipoOrdenId))) || "por valorar";
            return (
              <div key={c.id} className={cx("flex flex-wrap gap-3 p-3", c.estado !== "pendiente" && "opacity-60")}>
                <div className="w-full text-sm font-bold first-letter:uppercase sm:w-24 sm:shrink-0">{cuando(c)}</div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className={cx("font-semibold", c.estado === "anulada" && "line-through")}>{c.contacto}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.matricula && <Matricula>{c.matricula}</Matricula>}
                    {vehiculo && <span className="text-sm text-slate-600">{vehiculo}</span>}
                    {tipoNombre && <Pastilla color={tipoColor ?? undefined}>{tipoNombre}</Pastilla>}
                    {recibida && <Pastilla color="#047857">Recibido</Pastilla>}
                    {c.estado === "no_vino" && <Pastilla color="#b91c1c">No vino</Pastilla>}
                    {c.estado === "anulada" && <Pastilla color="#64748b">Anulada</Pastilla>}
                  </div>
                  {c.motivo && <p className="text-sm text-slate-700">{c.motivo}</p>}
                  {c.estado === "pendiente" && !recibida && (
                    <p className="text-xs text-slate-500">
                      {horasCita === "por valorar" ? "Horas por valorar" : `Previsto: ${horasCita}`}
                      {c.necesitaSustitucion && " · "}
                      {c.necesitaSustitucion && <b className="font-semibold text-slate-700">Necesita coche de sustitución</b>}
                    </p>
                  )}
                  {c.nota && <p className="text-sm italic text-slate-500">{c.nota}</p>}
                  <p className="text-xs text-slate-400">{creadoPorNombre ? `Cita dada por ${creadoPorNombre}` : ""}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {recibida ? (
                      <BotonLink variante="secundario" className="min-h-10 px-3" href={`/ot/${c.otId}`}>Ver orden</BotonLink>
                    ) : (
                      c.estado === "pendiente" && recibe && <BotonLink className="min-h-10 px-3" href={`/recepcion/nueva?cita=${c.id}`}>Recibir</BotonLink>
                    )}
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white">
                        <MessageCircle className="size-4" aria-hidden /> Confirmar por WhatsApp
                      </a>
                    )}
                    {c.telefono && (
                      <a href={`tel:${c.telefono.replace(/\s/g, "")}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 tabular-nums">
                        <Phone className="size-4" aria-hidden /> {c.telefono}
                      </a>
                    )}
                    {!recibida && <AccionesCita cita={editable} estado={c.estado} tipos={tipos} />}
                  </div>
                </div>
              </div>
            );
          })}
        </Tarjeta>
      )}
    </div>
  );
}

function Cabecera({ dia, vista, nueva }: { dia: string; vista: "dia" | "semana" | "mes"; nueva: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-sm text-slate-500">Cuándo traen los clientes el coche al taller.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SelectorVista vista={vista} dia={dia} />
        {nueva}
      </div>
    </div>
  );
}
