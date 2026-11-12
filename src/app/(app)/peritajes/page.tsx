import Link from "next/link";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Download, ShieldCheck } from "lucide-react";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { listarOTsAbiertas, tiposConEstados, type OTResumen } from "@/lib/data";
import { diaISO, diasDesde, fmtFecha } from "@/lib/formato";
import { Matricula, Pastilla, Tarjeta, Vacio, cx } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { AvanzarPeritaje, FechaPerito, Imprimir } from "./controles";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const sumarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtDiaLargo = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Fila = OTResumen & { fotos: number; destinoId: string | null };

/**
 * Lista del perito: coches de siniestro que esperan peritaje (por día, agrupados por compañía) y los ya
 * peritados que esperan la autorización. Se imprime o se enseña en la tablet cuando llega el perito.
 */
export default async function Peritajes({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const s = await requireSesion("peritajes");
  const hoy = diaISO();
  const pedido = (await searchParams).dia;
  const dia = pedido && DIA.test(pedido) ? pedido : hoy;
  const [ots, tipos] = await Promise.all([listarOTsAbiertas(s.tid), tiposConEstados(s.tid)]);

  // Por cada tipo con siniestro: el estado en el que se espera la autorización (p. ej. «Peritado»)
  const flujo = new Map(
    tipos
      .filter((tp) => tp.requiereSiniestro)
      .map((tp) => {
        const aprob = tp.estados.find((e) => e.requiereAprobacion);
        const siguiente = aprob ? tp.estados.find((e) => e.orden > aprob.orden && e.marca !== "final") : undefined;
        return [tp.id, { aprob, siguiente }] as const;
      }),
  );
  const siniestros = ots.filter((o) => !o.anuladaEn && flujo.get(o.tipoId)?.aprob);
  const ids = siniestros.map((o) => o.id);
  const fotos = ids.length
    ? await db
        .select({ otId: t.archivos.otId, n: sql<number>`count(*)::int` })
        .from(t.archivos)
        .where(and(eq(t.archivos.tallerId, s.tid), inArray(t.archivos.otId, ids)))
        .groupBy(t.archivos.otId)
    : [];
  const nFotos = new Map(fotos.map((f) => [f.otId, f.n]));

  const porPeritar: Fila[] = [];
  const peritados: Fila[] = [];
  for (const o of siniestros) {
    const { aprob, siguiente } = flujo.get(o.tipoId)!;
    if (o.estadoOrden < aprob!.orden) porPeritar.push({ ...o, fotos: nFotos.get(o.id) ?? 0, destinoId: aprob!.id });
    else if (o.estadoId === aprob!.id) peritados.push({ ...o, fotos: nFotos.get(o.id) ?? 0, destinoId: siguiente?.id ?? null });
  }
  const fechaDe = (o: Fila) => o.datosSiniestro?.fechaPeritaje ?? null;
  const delDia = porPeritar.filter((o) => fechaDe(o) === dia || (dia === hoy && fechaDe(o) !== null && fechaDe(o)! < hoy));
  const sinFecha = porPeritar.filter((o) => !fechaDe(o));
  const otrosDias = porPeritar.filter((o) => fechaDe(o) && !delDia.includes(o)).sort((a, b) => fechaDe(a)!.localeCompare(fechaDe(b)!));

  // Agrupar por compañía (el perito suele venir de una en concreto)
  const grupos = new Map<string, Fila[]>();
  for (const o of [...delDia].sort((a, b) => a.fechaEntrada.getTime() - b.fechaEntrada.getTime())) {
    const c = o.datosSiniestro?.companiaNombre ?? "Sin compañía";
    grupos.set(c, [...(grupos.get(c) ?? []), o]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Peritajes</h1>
          <p className="text-sm text-slate-500">Coches de siniestro por peritar y peritados a la espera de autorización.</p>
        </div>
        <Imprimir />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/peritajes?dia=${sumarDias(dia, -1)}`} className="grid size-11 place-items-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50" aria-label="Día anterior">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-48 text-center font-semibold">{dia === hoy ? `Hoy, ${fmtDiaLargo(dia)}` : mayuscula(fmtDiaLargo(dia))}</div>
        <Link href={`/peritajes?dia=${sumarDias(dia, 1)}`} className="grid size-11 place-items-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50" aria-label="Día siguiente">
          <ChevronRight className="size-5" aria-hidden />
        </Link>
        {dia !== hoy && <Link href="/peritajes" className="text-sm font-medium underline">Volver a hoy</Link>}
      </div>

      <section aria-labelledby="h-dia" className="space-y-3">
        <h2 id="h-dia" className="text-lg font-semibold">
          Para peritar {dia === hoy ? <><span className="print:hidden">hoy</span><span className="hidden print:inline">el {fmtFecha(dia)}</span></> : `el ${fmtFecha(dia)}`} <span className="text-slate-400">({delDia.length})</span>
        </h2>
        {delDia.length === 0 && <Tarjeta><Vacio>No hay coches con peritaje {dia === hoy ? "para hoy" : "ese día"}.</Vacio></Tarjeta>}
        {[...grupos].map(([compania, filas]) => (
          <div key={compania} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="size-4" aria-hidden /> {compania} · {filas.length}
            </h3>
            {filas.map((o) => <FilaPeritaje key={o.id} o={o} hoy={hoy} />)}
          </div>
        ))}
      </section>

      {sinFecha.length > 0 && (
        <section aria-labelledby="h-sin" className="space-y-2">
          <h2 id="h-sin" className="text-lg font-semibold">Sin día de peritaje <span className="text-slate-400">({sinFecha.length})</span></h2>
          <p className="text-sm text-slate-500 print:hidden">Apunta el día que viene el perito para que salgan en su lista.</p>
          {sinFecha.map((o) => <FilaPeritaje key={o.id} o={o} hoy={hoy} />)}
        </section>
      )}

      {otrosDias.length > 0 && (
        <section aria-labelledby="h-otros" className="space-y-2 print:hidden">
          <h2 id="h-otros" className="text-lg font-semibold">Otros días <span className="text-slate-400">({otrosDias.length})</span></h2>
          {otrosDias.map((o) => <FilaPeritaje key={o.id} o={o} hoy={hoy} />)}
        </section>
      )}

      <section aria-labelledby="h-peritados" className="space-y-2">
        <h2 id="h-peritados" className="text-lg font-semibold">Peritados, esperando autorización <span className="text-slate-400">({peritados.length})</span></h2>
        {peritados.length === 0 && <Tarjeta><Vacio>Ninguno.</Vacio></Tarjeta>}
        {peritados.map((o) => <FilaPeritaje key={o.id} o={o} hoy={hoy} peritado />)}
      </section>
    </div>
  );
}

function FilaPeritaje({ o, hoy, peritado = false }: { o: Fila; hoy: string; peritado?: boolean }) {
  const sin = o.datosSiniestro;
  const fecha = sin?.fechaPeritaje ?? null;
  const atrasado = !peritado && fecha !== null && fecha < hoy;
  const dias = diasDesde(o.fechaEntrada);
  return (
    <Tarjeta className="break-inside-avoid p-4">
      <div className="flex flex-wrap items-start gap-3">
        {o.marca && <LogoMarca marca={o.marca} className="size-9 shrink-0" />}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Matricula>{o.matricula}</Matricula>
            <span className="font-semibold">{o.marca} {o.modelo}</span>
            <Pastilla color={o.tipoColor}>{o.estadoNombre}</Pastilla>
            {atrasado && <Pastilla color="#b91c1c">Era el {fmtFecha(fecha)}</Pastilla>}
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-600">
            {sin?.companiaNombre && <div className="flex gap-1"><dt className="sr-only">Compañía</dt><dd className="font-medium text-slate-800">{sin.companiaNombre}</dd></div>}
            <div className="flex gap-1"><dt>Siniestro</dt><dd className="font-medium tabular-nums text-slate-800">{sin?.numeroSiniestro || "—"}</dd></div>
            {sin?.numeroPoliza && <div className="flex gap-1"><dt>Póliza</dt><dd className="tabular-nums">{sin.numeroPoliza}</dd></div>}
            <div className="flex gap-1"><dt>Cliente</dt><dd>{o.clienteNombre}</dd></div>
            <div className="flex gap-1"><dt>Entró</dt><dd>{fmtFecha(o.fechaEntrada)} ({dias === 0 ? "hoy" : `hace ${dias} d`})</dd></div>
            {sin?.perito && <div className="flex gap-1"><dt>Perito</dt><dd className="font-medium text-slate-800">{sin.perito}</dd></div>}
            {peritado && fecha && <div className="flex gap-1"><dt>Peritado</dt><dd>{fmtFecha(fecha)}</dd></div>}
          </dl>
          <p className="line-clamp-2 text-sm">{o.trabajo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <a
            href={`/api/ot/${o.id}/fotos`}
            className={cx(
              "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold",
              o.fotos ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50" : "pointer-events-none border-slate-200 text-slate-400",
            )}
            aria-disabled={!o.fotos}
          >
            <Download className="size-4" aria-hidden /> Fotos ({o.fotos})
          </a>
          <Link href={`/ot/${o.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Ficha
          </Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 print:hidden">
        {!peritado && (
          <div className="min-w-0 flex-1 basis-72">
            <FechaPerito otId={o.id} fecha={fecha} perito={sin?.perito ?? null} />
          </div>
        )}
        {o.destinoId &&
          (peritado ? (
            <AvanzarPeritaje otId={o.id} destinoId={o.destinoId} etiqueta="Autorizado" ayuda="¿Cómo lo ha autorizado la compañía? (p. ej. «Autoriza Mutua, valoración 1.250 €»)" notaObligatoria />
          ) : (
            <AvanzarPeritaje otId={o.id} destinoId={o.destinoId} etiqueta="Peritado" ayuda="Nota del peritaje" />
          ))}
      </div>
    </Tarjeta>
  );
}
