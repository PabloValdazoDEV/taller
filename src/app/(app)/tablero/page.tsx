import Link from "next/link";
import { requireSesion } from "@/lib/auth";
import { listarOTsAbiertas, tiposConEstados, type OTResumen } from "@/lib/data";
import { OtTarjeta } from "@/components/ot-tarjeta";
import { AutoRefresco } from "@/components/auto-refresco";
import { cx } from "@/components/ui";
import { SelectorTipo } from "./selector-tipo";

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
  if (o.requiereAprobacion || /pendiente|esperando/i.test(o.estadoNombre)) return "espera";
  return "curso";
}

export default async function Tablero({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const s = await requireSesion();
  const { tipo: tipoSel = "todos" } = await searchParams;
  const [tipos, ots] = await Promise.all([tiposConEstados(s.tid), listarOTsAbiertas(s.tid)]);
  const tipo = tipos.find((tp) => tp.codigo === tipoSel);

  const columnas = tipo
    ? tipo.estados
        .filter((e) => e.marca !== "final")
        .map((e) => ({ clave: e.id, nombre: e.nombre, color: tipo.color, ots: ots.filter((o) => o.estadoId === e.id) }))
    : FASES.map((f) => ({ ...f, ots: ots.filter((o) => fase(o) === f.clave) }));

  return (
    <div>
      <AutoRefresco segundos={15} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tablero</h1>
        <span className="text-sm text-slate-500">{ots.length} vehículos en taller</span>
      </div>

      <SelectorTipo
        valor={tipo?.codigo ?? "todos"}
        opciones={[{ codigo: "todos", texto: `Todos los tipos (${ots.length})` }, ...tipos.map((tp) => ({ codigo: tp.codigo, texto: `${tp.nombre} (${ots.filter((o) => o.tipoId === tp.id).length})` }))]}
      />
      <div className="mb-4 hidden flex-wrap gap-2 sm:flex">
        <PestanaTipo href="/tablero" activa={!tipo} color="#0f172a" texto="Todos" n={ots.length} />
        {tipos.map((tp) => (
          <PestanaTipo key={tp.id} href={`/tablero?tipo=${tp.codigo}`} activa={tipo?.id === tp.id} color={tp.color} texto={tp.nombre} n={ots.filter((o) => o.tipoId === tp.id).length} />
        ))}
      </div>

      {/* Columnas en rejilla (sin scroll horizontal): 1 en el móvil, y tantas como quepan de ~17rem */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
        {columnas.map((c) => (
          <section key={c.clave} aria-label={c.nombre}>
            <header className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                {c.nombre}
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200 rounded-full px-2">{c.ots.length}</span>
            </header>
            <div className={cx("space-y-2 rounded-2xl bg-slate-200/50 p-2", c.ots.length ? "sm:min-h-24" : "min-h-12")}>
              {c.ots.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-500">Ninguno</p>}
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
      aria-current={activa ? "page" : undefined}
      className={cx("inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium", activa ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-700")}
      style={activa ? { background: color } : undefined}
    >
      {texto}
      <span className={cx("text-xs rounded-full px-1.5", activa ? "bg-white/25" : "bg-slate-100")}>{n}</span>
    </Link>
  );
}
