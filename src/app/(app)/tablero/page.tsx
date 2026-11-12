import Link from "next/link";
import { requireSesion } from "@/lib/auth";
import { listarOTsAbiertas, mecanicos, tiposConEstados, type OTResumen } from "@/lib/data";
import { esperaAprobacionOPerito, esRetrasada } from "@/lib/ots";
import { SelectorMecanico } from "./selector-mecanico";
import { OtTarjeta } from "@/components/ot-tarjeta";
import { AutoRefresco } from "@/components/auto-refresco";
import { cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const FASES = [
  { clave: "entrada", nombre: "Entrada", color: "#64748b" },
  { clave: "espera", nombre: "En espera (aprobación, perito, piezas)", color: "#7c3aed" },
  { clave: "curso", nombre: "En curso", color: "#1d4ed8" },
  { clave: "listo", nombre: "Listo para entregar", color: "#059669" },
] as const;

function fase(o: OTResumen) {
  if (o.estadoMarca === "listo") return "listo";
  if (o.estadoOrden === 0) return "entrada";
  if (esperaAprobacionOPerito(o) || /pendiente|esperando/i.test(o.estadoNombre)) return "espera";
  return "curso";
}

/** Filtros rápidos (también los usan los indicadores de Inicio). */
const FILTROS = {
  retrasados: { nombre: "Retrasados", color: "#dc2626", es: (o: OTResumen) => esRetrasada(o) },
  espera: { nombre: "Aprobación / perito", color: "#7c3aed", es: (o: OTResumen) => esperaAprobacionOPerito(o) },
  incidencias: { nombre: "Con incidencias", color: "#d97706", es: (o: OTResumen) => o.incidenciasAbiertas > 0 },
  listos: { nombre: "Listos", color: "#059669", es: (o: OTResumen) => o.estadoMarca === "listo" },
} as const;
type ClaveFiltro = keyof typeof FILTROS;

type Params = { tipo?: string; filtro?: string; mecanico?: string };

export default async function Tablero({ searchParams }: { searchParams: Promise<Params> }) {
  const s = await requireSesion();
  const sp = await searchParams;
  const { tipo: tipoSel = "todos" } = sp;
  const filtro = sp.filtro && sp.filtro in FILTROS ? (sp.filtro as ClaveFiltro) : null;
  const [tipos, todas, mecs] = await Promise.all([tiposConEstados(s.tid), listarOTsAbiertas(s.tid), mecanicos(s.tid)]);
  const tipo = tipos.find((tp) => tp.codigo === tipoSel);

  // Filtros de filtro rápido y mecánico (el de tipo se aplica en las columnas)
  const ots = todas.filter(
    (o) => (!filtro || FILTROS[filtro].es(o)) && (!sp.mecanico || (sp.mecanico === "sin" ? !o.mecanicoId : o.mecanicoId === sp.mecanico)),
  );
  const url = (cambios: Partial<Params>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ tipo: sp.tipo, filtro: sp.filtro, mecanico: sp.mecanico, ...cambios })) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/tablero?${qs}` : "/tablero";
  };

  const columnas = tipo
    ? tipo.estados
        .filter((e) => e.marca !== "final")
        .map((e) => ({ clave: e.id, nombre: e.nombre, color: tipo.color, ots: ots.filter((o) => o.estadoId === e.id) }))
    : FASES.map((f) => ({ ...f, ots: ots.filter((o) => fase(o) === f.clave) }));
  const filtrando = !!filtro || !!sp.mecanico;

  return (
    <div>
      <AutoRefresco segundos={15} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tablero</h1>
        <span className="text-sm text-slate-500">
          {filtrando ? `${ots.length} de ${todas.length}` : todas.length} vehículos en taller
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <PestanaTipo href={url({ tipo: undefined })} activa={!tipo} color="#0f172a" texto="Todos" n={ots.length} />
        {tipos.map((tp) => (
          <PestanaTipo key={tp.id} href={url({ tipo: tp.codigo })} activa={tipo?.id === tp.id} color={tp.color} texto={tp.nombre} n={ots.filter((o) => o.tipoId === tp.id).length} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(Object.keys(FILTROS) as ClaveFiltro[]).map((k) => {
          const n = todas.filter(FILTROS[k].es).length;
          const activo = filtro === k;
          return (
            <Link
              key={k}
              href={url({ filtro: activo ? undefined : k })}
              className={cx("inline-flex items-center gap-1.5 rounded-full px-3 min-h-10 text-sm font-medium border", activo ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-700")}
              style={activo ? { background: FILTROS[k].color } : { borderLeft: `4px solid ${FILTROS[k].color}` }}
            >
              {FILTROS[k].nombre} <span className={cx("text-xs rounded-full px-1.5", activo ? "bg-white/25" : "bg-slate-100")}>{n}</span>
            </Link>
          );
        })}
        <form action="/tablero" className="ml-auto flex items-center gap-2">
          {sp.tipo && <input type="hidden" name="tipo" value={sp.tipo} />}
          {sp.filtro && <input type="hidden" name="filtro" value={sp.filtro} />}
          <SelectorMecanico valor={sp.mecanico ?? ""} mecanicos={mecs} />
        </form>
        {filtrando && (
          <Link href={url({ filtro: undefined, mecanico: undefined })} className="text-sm text-slate-500 underline min-h-10 inline-flex items-center">
            Quitar filtros
          </Link>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x">
        {columnas.map((c) => (
          <section key={c.clave} className="w-72 shrink-0 snap-start">
            <header className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                {c.nombre}
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200 rounded-full px-2">{c.ots.length}</span>
            </header>
            <div className="space-y-2 min-h-24 rounded-2xl bg-slate-200/50 p-2">
              {c.ots.map((o) => <OtTarjeta key={o.id} ot={o} mostrarEstado={!tipo} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PestanaTipo({ href, activa, color, texto, n }: { href: string; activa: boolean; color: string; texto: string; n: number }) {
  return (
    <Link
      href={href}
      className={cx("shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium border", activa ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-700")}
      style={activa ? { background: color } : undefined}
    >
      {texto}
      <span className={cx("text-xs rounded-full px-1.5", activa ? "bg-white/25" : "bg-slate-100")}>{n}</span>
    </Link>
  );
}
