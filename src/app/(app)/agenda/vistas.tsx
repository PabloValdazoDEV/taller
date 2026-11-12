import Link from "next/link";
import { CarFront, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { BotonLink, Matricula, Pastilla, Tarjeta, Vacio, cx } from "@/components/ui";
import { cuando, diaCorto } from "@/lib/citas";
import { diaISO } from "@/lib/formato";
import { sumarDias as sumar } from "@/lib/capacidad";
import type { CargaDia } from "@/lib/carga";
import type { CitaDia } from "@/lib/data";
import { PUNTO } from "./carga";

/** Cita con lo que hace falta para las vistas de semana y mes */
export type CitaVista = CitaDia & { porValorar: boolean };

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRE_MES = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

const porDia = (citas: CitaVista[]) => {
  const m = new Map<string, CitaVista[]>();
  for (const x of citas) {
    const d = diaISO(x.c.fechaHora);
    m.set(d, [...(m.get(d) ?? []), x]);
  }
  return m;
};

/** Selector Día / Semana / Mes */
export function SelectorVista({ vista, dia }: { vista: "dia" | "semana" | "mes"; dia: string }) {
  const op = [
    { v: "dia", t: "Día" },
    { v: "semana", t: "Semana" },
    { v: "mes", t: "Mes" },
  ] as const;
  return (
    <nav aria-label="Vista de la agenda" className="inline-grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
      {op.map((o) => (
        <Link
          key={o.v}
          href={`/agenda?${new URLSearchParams({ dia, ...(o.v !== "dia" ? { vista: o.v } : {}) })}`}
          aria-current={vista === o.v ? "page" : undefined}
          className={cx("inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-medium", vista === o.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
        >
          {o.t}
        </Link>
      ))}
    </nav>
  );
}

/** Cifras del periodo: citas, recibidas, no vinieron, por valorar, coches de sustitución, días sin abasto */
export function Resumen({ citas, carga }: { citas: CitaVista[]; carga: Record<string, CargaDia> }) {
  const activas = citas.filter((x) => x.c.estado !== "anulada");
  const pendientes = activas.filter((x) => x.c.estado === "pendiente" && !x.c.otId);
  const llenos = Object.values(carga).filter((c) => c.nivel === "lleno").length;
  const datos = [
    { n: activas.length, t: activas.length === 1 ? "cita" : "citas" },
    { n: activas.filter((x) => x.c.otId).length, t: "recibidas" },
    { n: activas.filter((x) => x.c.estado === "no_vino").length, t: "no vinieron", rojo: true },
    { n: pendientes.filter((x) => x.porValorar).length, t: "por valorar" },
    { n: pendientes.filter((x) => x.c.necesitaSustitucion).length, t: "con coche de sustitución" },
    { n: llenos, t: llenos === 1 ? "día sin abasto" : "días sin abasto", rojo: true },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {datos.map((d) => (
        <Tarjeta key={d.t} className="px-3 py-2">
          <div className={cx("text-xl font-bold tabular-nums", d.rojo && d.n > 0 && "text-red-700")}>{d.n}</div>
          <div className="text-xs text-slate-500">{d.t}</div>
        </Tarjeta>
      ))}
    </div>
  );
}

function Navegar({ antes, despues, titulo, hoyHref }: { antes: string; despues: string; titulo: string; hoyHref?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={antes} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-200/60" aria-label="Anterior">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <h2 className="min-w-0 flex-1 text-center text-lg font-semibold first-letter:uppercase">{titulo}</h2>
      {hoyHref && <BotonLink variante="fantasma" className="min-h-10 px-3" href={hoyHref}>Hoy</BotonLink>}
      <Link href={despues} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-200/60" aria-label="Siguiente">
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </div>
  );
}

function FilaCita({ x }: { x: CitaVista }) {
  const { c } = x;
  return (
    <Link href={`/agenda?dia=${diaISO(c.fechaHora)}`} className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-slate-50", c.estado !== "pendiente" && "opacity-60")}>
      <span className="w-28 shrink-0 text-sm font-semibold first-letter:uppercase">{cuando(c)}</span>
      <span className={cx("min-w-0 truncate font-medium", c.estado === "anulada" && "line-through")}>{c.contacto}</span>
      {c.matricula && <Matricula>{c.matricula}</Matricula>}
      {x.tipoNombre && <Pastilla color={x.tipoColor ?? undefined}>{x.tipoNombre}</Pastilla>}
      {c.otId && <Pastilla color="#047857">Recibido</Pastilla>}
      {c.estado === "no_vino" && <Pastilla color="#b91c1c">No vino</Pastilla>}
      {c.estado === "anulada" && <Pastilla color="#64748b">Anulada</Pastilla>}
      {c.estado === "pendiente" && !c.otId && x.porValorar && (
        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><HelpCircle className="size-3.5" aria-hidden /> Por valorar</span>
      )}
      {c.estado === "pendiente" && !c.otId && c.necesitaSustitucion && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700"><CarFront className="size-3.5" aria-hidden /> Coche de sustitución</span>
      )}
    </Link>
  );
}

/** Semana: cada día con su semáforo y sus citas */
export function VistaSemana({ lunes, hoy, citas, carga }: { lunes: string; hoy: string; citas: CitaVista[]; carga: Record<string, CargaDia> }) {
  const dias = porDia(citas);
  const domingo = sumar(lunes, 6);
  const titulo = `Semana del ${Number(lunes.slice(8))} ${lunes.slice(5, 7) === domingo.slice(5, 7) ? "" : `/${lunes.slice(5, 7)} `}al ${Number(domingo.slice(8))}/${domingo.slice(5, 7)}`;
  return (
    <div className="space-y-3">
      <Navegar antes={`/agenda?vista=semana&dia=${sumar(lunes, -7)}`} despues={`/agenda?vista=semana&dia=${sumar(lunes, 7)}`} titulo={titulo} hoyHref={hoy < lunes || hoy > domingo ? `/agenda?vista=semana&dia=${hoy}` : undefined} />
      <Resumen citas={citas} carga={carga} />
      {LETRAS.map((_, i) => {
        const d = sumar(lunes, i);
        const lista = dias.get(d) ?? [];
        const cg = carga[d];
        if (!lista.length && cg && !cg.abierto) return null; // fin de semana sin citas
        const n = lista.filter((x) => x.c.estado !== "anulada").length;
        return (
          <Tarjeta key={d} className={cx("overflow-hidden", d < hoy && "opacity-75")}>
            <Link href={`/agenda?dia=${d}`} className={cx("flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2", d === hoy ? "bg-slate-900 text-white" : "bg-slate-50 hover:bg-slate-100")}>
              <span className="font-semibold first-letter:uppercase">{diaCorto(`${d}T12:00:00Z`, false)}</span>
              {d === hoy && <span className="text-xs">(hoy)</span>}
              <span className={cx("text-sm", d === hoy ? "text-slate-300" : "text-slate-500")}>{n} {n === 1 ? "cita" : "citas"}</span>
              {cg && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
                  <span className={cx("size-2.5 rounded-full", PUNTO[cg.nivel].clase)} aria-hidden /> {PUNTO[cg.nivel].texto}
                </span>
              )}
            </Link>
            {cg && cg.nivel === "lleno" && <p className="border-b border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-800">{cg.avisos.filter((a) => !a.startsWith("El taller")).join(" · ")}</p>}
            {lista.length ? <div className="divide-y divide-slate-100">{lista.map((x) => <FilaCita key={x.c.id} x={x} />)}</div> : <p className="px-3 py-2 text-sm text-slate-400">Sin citas</p>}
          </Tarjeta>
        );
      })}
    </div>
  );
}

/** Mes: calendario con el nº de citas y el semáforo de cada día */
export function VistaMes({ dia, hoy, citas, carga }: { dia: string; hoy: string; citas: CitaVista[]; carga: Record<string, CargaDia> }) {
  const primero = `${dia.slice(0, 7)}-01`;
  const inicio = sumar(primero, -((new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7));
  const sigMes = sumar(primero, 32).slice(0, 7) + "-01";
  const antMes = sumar(primero, -1).slice(0, 7) + "-01";
  const semanas = Math.ceil((Date.parse(sigMes) - Date.parse(inicio)) / (7 * 86_400_000));
  const dias = porDia(citas);
  const delMes = citas.filter((x) => diaISO(x.c.fechaHora).startsWith(dia.slice(0, 7)));
  return (
    <div className="space-y-3">
      <Navegar
        antes={`/agenda?vista=mes&dia=${antMes}`}
        despues={`/agenda?vista=mes&dia=${sigMes}`}
        titulo={NOMBRE_MES.format(new Date(`${primero}T12:00:00Z`))}
        hoyHref={hoy.slice(0, 7) !== dia.slice(0, 7) ? `/agenda?vista=mes&dia=${hoy}` : undefined}
      />
      <Resumen citas={delMes} carga={Object.fromEntries(Object.entries(carga).filter(([d]) => d.startsWith(dia.slice(0, 7))))} />
      <Tarjeta className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold text-slate-500">
          {LETRAS.map((l) => <div key={l} className="py-1.5">{l}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: semanas * 7 }, (_, i) => {
            const d = sumar(inicio, i);
            const fuera = d.slice(0, 7) !== dia.slice(0, 7);
            const lista = (dias.get(d) ?? []).filter((x) => x.c.estado !== "anulada");
            const cg = carga[d];
            return (
              <Link
                key={d}
                href={`/agenda?dia=${d}`}
                aria-label={`${diaCorto(`${d}T12:00:00Z`, false)}: ${lista.length} citas${cg ? `, ${PUNTO[cg.nivel].texto.toLowerCase()}` : ""}`}
                className={cx(
                  "flex min-h-16 flex-col gap-0.5 border-b border-r border-slate-100 p-1 text-left hover:bg-slate-50 sm:min-h-24 sm:p-1.5",
                  (i + 1) % 7 === 0 && "border-r-0",
                  fuera && "bg-slate-50/60 text-slate-400",
                  d < hoy && !fuera && "text-slate-400",
                )}
              >
                <span className="flex items-center gap-1">
                  <span className={cx("grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums", d === hoy && "bg-slate-900 text-white")}>{Number(d.slice(8))}</span>
                  {cg && !fuera && cg.nivel !== "cerrado" && <span className={cx("size-2 rounded-full", PUNTO[cg.nivel].clase)} aria-hidden />}
                </span>
                {lista.length > 0 && (
                  <>
                    <span className="w-fit rounded-full bg-amber-100 px-1.5 text-[11px] font-bold leading-4 text-amber-900 sm:hidden">{lista.length}</span>
                    <span className="hidden space-y-0.5 sm:block">
                      {lista.slice(0, 3).map((x) => (
                        <span key={x.c.id} className={cx("block truncate rounded px-1 text-[11px] leading-4", x.c.otId ? "bg-emerald-50 text-emerald-900" : x.c.estado === "no_vino" ? "bg-red-50 text-red-900 line-through" : "bg-slate-100 text-slate-800")}>
                          {x.c.franja ? "" : `${cuando(x.c).replace("a las ", "")} `}
                          {x.c.contacto}
                        </span>
                      ))}
                      {lista.length > 3 && <span className="block px-1 text-[11px] text-slate-500">+{lista.length - 3} más</span>}
                    </span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </Tarjeta>
      {delMes.length === 0 && <Tarjeta><Vacio>No hay citas este mes.</Vacio></Tarjeta>}
    </div>
  );
}
