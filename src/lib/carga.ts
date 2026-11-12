import "server-only";
/*
 * Carga del taller por día, para dar citas con cabeza: horas de trabajo por especialidad, plazas,
 * coches de sustitución y recepciones por franja. Es una estimación y SOLO AVISA (siempre se puede
 * meter un coche más).
 *
 * Cómo se estima:
 *  - Disponible: horas al día de cada mecánico activo, los días que trabaja, en su especialidad. Quien tiene varias
 *    (p. ej. chapa y pintura) reparte sus horas a lo que más falte ese día.
 *  - Coches ya en el taller: la mano de obra de sus líneas (si no tiene, la del tipo de trabajo) repartida
 *    entre hoy y su fecha prevista de entrega; sin fecha o con retraso, en los días que salgan a 8 h por día.
 *    «Listo para entregar» ya no suma horas, pero ocupa plaza hasta su fecha prevista.
 *  - Citas pendientes: sus horas (o las del tipo) desde el día de la cita, a 8 h por día de trabajo.
 *  - «Por valorar» (siniestros, averías… sin horas hasta verlos): ocupan plaza y recepción y se cuentan aparte.
 *  - Coches de sustitución: los prestados siguen fuera mientras su orden siga abierta (sin orden: hasta que vuelvan).
 */
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { tallerPorId } from "./taller";
import { diaISO, fmtHora, inicioDia } from "./formato";
import { ESPECIALIDADES, NOMBRE_ESPECIALIDAD, type Especialidad } from "./importes";
import { FRANJAS, franjaDeHora, type Franja } from "./citas";
import { DIAS_ABIERTOS_BASE, JORNADA, diaSemana, fmtH, hayHoras, horasTipo, sumarDias, totalHoras, type Horas } from "./capacidad";
import type { TallerConfig } from "@/db/schema";

export type Nivel = "libre" | "justo" | "lleno" | "cerrado";
export type CargaDia = {
  dia: string;
  abierto: boolean;
  horas: { esp: Especialidad; disp: number; ocup: number }[];
  plazas: { total: number; ocup: number } | null;
  /** Coches sin horas todavía (por valorar) */
  porValorar: number;
  sustitucion: { total: number; ocup: number };
  franjas: { id: Franja; nombre: string; n: number }[];
  maxPorFranja: number | null;
  nivel: Nivel;
  avisos: string[];
};

/** Lo que pesa un trabajo (cita u orden) en el día. */
type Trabajo = { dias: string[]; horas: Horas; plaza: boolean; sust: boolean; valorar?: boolean; franja?: { dia: string; id: Franja } };
type Acum = { horas: Record<Especialidad, number>; plazas: number; sust: number; valorar: number; franjas: Record<Franja, number> };

type Contexto = {
  hoy: string;
  abiertos: number[];
  plazas: number | null;
  maxPorFranja: number | null;
  coches: number;
  disponible: (dia: string, demanda: Record<Especialidad, number>) => Record<Especialidad, number>;
  /** Días que ocupa un trabajo que empieza `desde` (el propio día y los siguientes en que abre el taller) */
  diasDesde: (desde: string, horas: number) => string[];
  diasHasta: (desde: string, hasta: string) => string[];
  cfg: TallerConfig;
  tipos: Map<string, { id: string; codigo: string }>;
};

const vacioAcum = (): Acum => ({
  horas: { mecanica: 0, chapa: 0, pintura: 0, lunas: 0 },
  plazas: 0,
  sust: 0,
  valorar: 0,
  franjas: { primera_hora: 0, manana: 0, mediodia: 0, tarde: 0, ultima_hora: 0 },
});

function anadir(acc: Map<string, Acum>, w: Trabajo, signo = 1) {
  const n = w.dias.length || 1;
  for (const d of w.dias) {
    const a = acc.get(d);
    if (!a) continue;
    for (const e of ESPECIALIDADES) if (w.horas[e]) a.horas[e] += (signo * w.horas[e]!) / n;
    if (w.plaza) a.plazas += signo;
    if (w.sust) a.sust += signo;
    if (w.valorar) a.valorar += signo;
  }
  if (w.franja) {
    const a = acc.get(w.franja.dia);
    if (a) a.franjas[w.franja.id] += signo;
  }
}

async function contexto(tid: string): Promise<Contexto> {
  const [taller, mecs, coches, tipos] = await Promise.all([
    tallerPorId(tid),
    db
      .select({ especialidades: t.usuarios.especialidades, horasDia: t.usuarios.horasDia, dias: t.usuarios.diasTrabajo })
      .from(t.usuarios)
      .where(and(eq(t.usuarios.tallerId, tid), eq(t.usuarios.activo, true), sql`${"mecanico"} = any(${t.usuarios.puestos})`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(t.cochesSustitucion)
      .where(and(eq(t.cochesSustitucion.tallerId, tid), eq(t.cochesSustitucion.activo, true), sql`${t.cochesSustitucion.estado} <> 'mantenimiento'`)),
    db.select({ id: t.tiposOrden.id, codigo: t.tiposOrden.codigo }).from(t.tiposOrden).where(eq(t.tiposOrden.tallerId, tid)),
  ]);
  const cfg = taller.config;
  const cap = cfg.capacidad ?? {};
  const abiertos = cap.diasAbiertos?.length ? cap.diasAbiertos : DIAS_ABIERTOS_BASE;
  const abre = (d: string) => abiertos.includes(diaSemana(d));
  const diasDesde = (desde: string, horas: number) => {
    const k = Math.max(1, Math.ceil(horas / JORNADA - 1e-9));
    const r = [desde];
    for (let d = sumarDias(desde, 1), i = 0; r.length < k && i < 60; d = sumarDias(d, 1), i++) if (abre(d)) r.push(d);
    return r;
  };
  const diasHasta = (desde: string, hasta: string) => {
    const r: string[] = [];
    for (let d = desde, i = 0; d <= hasta && i < 120; d = sumarDias(d, 1), i++) if (abre(d)) r.push(d);
    return r.length ? r : [desde];
  };
  return {
    hoy: diaISO(),
    abiertos,
    plazas: cap.plazas ?? null,
    maxPorFranja: cap.maxPorFranja ?? null,
    coches: coches[0]?.n ?? 0,
    disponible: (dia, demanda) => {
      const ds = diaSemana(dia);
      return repartir(
        mecs.filter((m) => m.dias.includes(ds)).map((m) => ({ esps: m.especialidades.length ? m.especialidades : ["mecanica" as const], h: Number(m.horasDia) })),
        demanda,
      );
    },
    diasDesde,
    diasHasta,
    cfg,
    tipos: new Map(tipos.map((x) => [x.id, x])),
  };
}

/**
 * Horas disponibles por especialidad un día. Quien tiene una sola especialidad suma ahí; quien tiene varias
 * reparte sus horas a la especialidad que más falte (y lo que le sobre, a partes iguales).
 */
function repartir(mecs: { esps: Especialidad[]; h: number }[], demanda: Record<Especialidad, number>) {
  const disp: Record<Especialidad, number> = { mecanica: 0, chapa: 0, pintura: 0, lunas: 0 };
  const flex = mecs.filter((m) => m.esps.length > 1);
  for (const m of mecs) if (m.esps.length === 1) disp[m.esps[0]] += m.h;
  for (const f of flex) {
    let resto = f.h;
    for (let i = 0; resto > 1e-9 && i < 10; i++) {
      const e = f.esps.reduce((a, b) => (demanda[b] - disp[b] > demanda[a] - disp[a] ? b : a));
      const falta = demanda[e] - disp[e];
      if (falta <= 1e-9) break;
      const dar = Math.min(resto, falta);
      disp[e] += dar;
      resto -= dar;
    }
    if (resto > 1e-9) for (const e of f.esps) disp[e] += resto / f.esps.length;
  }
  return disp;
}

/** Trabajos ya comprometidos (coches en el taller, préstamos y citas pendientes) hasta `hasta`. */
async function comprometido(tid: string, ctx: Contexto, hasta: string, excluirCitaId?: string | null): Promise<Trabajo[]> {
  const { hoy } = ctx;
  const ots = await db
    .select({ id: t.ordenesTrabajo.id, tipoOrdenId: t.ordenesTrabajo.tipoOrdenId, fechaPrevista: t.ordenesTrabajo.fechaPrevista, marca: t.estadosFlujo.marca })
    .from(t.ordenesTrabajo)
    .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.ordenesTrabajo.estadoId))
    .where(and(eq(t.ordenesTrabajo.tallerId, tid), isNull(t.ordenesTrabajo.cerradaEn), isNull(t.ordenesTrabajo.anuladaEn)));
  const ids = ots.map((o) => o.id);
  const [mo, prestamos, citas] = await Promise.all([
    ids.length
      ? db
          .select({ otId: t.lineasOt.otId, esp: t.lineasOt.especialidad, h: sql<string>`sum(${t.lineasOt.cantidad})` })
          .from(t.lineasOt)
          .where(and(eq(t.lineasOt.tallerId, tid), inArray(t.lineasOt.otId, ids), eq(t.lineasOt.tipo, "mano_obra")))
          .groupBy(t.lineasOt.otId, t.lineasOt.especialidad)
      : [],
    db.select({ otId: t.prestamos.otId }).from(t.prestamos).where(and(eq(t.prestamos.tallerId, tid), isNull(t.prestamos.devueltoEn))),
    db
      .select({ id: t.citas.id, fechaHora: t.citas.fechaHora, franja: t.citas.franja, horas: t.citas.horas, tipoOrdenId: t.citas.tipoOrdenId, sust: t.citas.necesitaSustitucion })
      .from(t.citas)
      .where(and(eq(t.citas.tallerId, tid), eq(t.citas.estado, "pendiente"), isNull(t.citas.otId), gte(t.citas.fechaHora, inicioDia(hoy)), lt(t.citas.fechaHora, inicioDia(sumarDias(hasta, 1))))),
  ]);

  const horasOt = new Map<string, Horas>();
  for (const l of mo) {
    const h = horasOt.get(l.otId) ?? {};
    const e = ((ESPECIALIDADES as readonly string[]).includes(l.esp ?? "") ? l.esp : "mecanica") as Especialidad;
    h[e] = (h[e] ?? 0) + Number(l.h);
    horasOt.set(l.otId, h);
  }

  const trabajos: Trabajo[] = [];
  const diasOt = new Map<string, string[]>();
  for (const o of ots) {
    const listo = o.marca === "listo" || o.marca === "final";
    const h = listo ? {} : (horasOt.get(o.id) ?? horasTipo(ctx.cfg, ctx.tipos.get(o.tipoOrdenId)));
    const dias = o.fechaPrevista && o.fechaPrevista >= hoy ? ctx.diasHasta(hoy, o.fechaPrevista) : ctx.diasDesde(hoy, totalHoras(h));
    diasOt.set(o.id, dias);
    trabajos.push({ dias, horas: h, plaza: true, sust: false, valorar: !listo && !hayHoras(h) });
  }
  // Préstamos: fuera mientras la orden siga abierta; sin orden (o ya cerrada), hasta que vuelva
  for (const p of prestamos) {
    const dias = p.otId ? diasOt.get(p.otId) : undefined;
    trabajos.push({ dias: dias ?? todosLosDias(hoy, hasta), horas: {}, plaza: false, sust: true });
  }
  for (const c of citas) {
    if (c.id === excluirCitaId) continue;
    trabajos.push(trabajoCita(ctx, { dia: diaISO(c.fechaHora), franja: c.franja ?? franjaDeHora(fmtHora(c.fechaHora)), horas: c.horas, tipoOrdenId: c.tipoOrdenId, sust: c.sust }));
  }
  return trabajos;
}

const todosLosDias = (desde: string, hasta: string) => {
  const r: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) r.push(d);
  return r;
};

export type CitaPrevista = { dia: string; franja: Franja; horas: Horas; tipoOrdenId: string | null; sust: boolean };

function trabajoCita(ctx: Contexto, c: CitaPrevista): Trabajo {
  const h = hayHoras(c.horas) ? c.horas : horasTipo(ctx.cfg, c.tipoOrdenId ? ctx.tipos.get(c.tipoOrdenId) : null);
  return { dias: ctx.diasDesde(c.dia, totalHoras(h)), horas: h, plaza: true, sust: c.sust, valorar: !hayHoras(h), franja: { dia: c.dia, id: c.franja } };
}

/** Qué va justo o pasado en un día, con la clave de a qué afecta (para quedarse solo con lo que toca a una cita). */
type Marca = { clave: string; nivel: "justo" | "lleno" | "cerrado"; texto?: string };

function evaluar(ctx: Contexto, dia: string, a: Acum): CargaDia & { marcas: Marca[] } {
  const abierto = ctx.abiertos.includes(diaSemana(dia));
  const disp = ctx.disponible(dia, a.horas);
  const horas = ESPECIALIDADES.map((esp) => ({ esp, disp: disp[esp], ocup: Math.round(a.horas[esp] * 100) / 100 })).filter((x) => x.disp > 0 || x.ocup > 0.01);
  const plazas = ctx.plazas ? { total: ctx.plazas, ocup: a.plazas } : null;
  const sustitucion = { total: ctx.coches, ocup: a.sust };
  const franjas = FRANJAS.map((f) => ({ id: f.id, nombre: f.nombre, n: a.franjas[f.id] }));
  const marcas: Marca[] = [];
  if (!abierto) marcas.push({ clave: "cerrado", nivel: "cerrado", texto: "El taller no abre ese día" });
  for (const h of horas) {
    const nombre = NOMBRE_ESPECIALIDAD[h.esp];
    if (h.ocup > h.disp + 0.01)
      marcas.push({ clave: `esp:${h.esp}`, nivel: "lleno", texto: h.disp ? `${nombre}: ${fmtH(h.ocup)} h de trabajo para ${fmtH(h.disp)} h disponibles` : `${nombre}: ${fmtH(h.ocup)} h y nadie de ${nombre.toLowerCase()} trabaja ese día` });
    else if (h.disp && h.ocup >= h.disp * 0.85) marcas.push({ clave: `esp:${h.esp}`, nivel: "justo" });
  }
  if (plazas) {
    if (plazas.ocup > plazas.total) marcas.push({ clave: "plazas", nivel: "lleno", texto: `Plazas: ${plazas.ocup} coches para ${plazas.total} plazas` });
    else if (plazas.ocup >= plazas.total * 0.85) marcas.push({ clave: "plazas", nivel: "justo" });
  }
  if (sustitucion.ocup > sustitucion.total) marcas.push({ clave: "sust", nivel: "lleno", texto: `Coches de sustitución: hacen falta ${sustitucion.ocup} y hay ${sustitucion.total}` });
  else if (sustitucion.ocup && sustitucion.ocup === sustitucion.total) marcas.push({ clave: "sust", nivel: "justo" });
  if (ctx.maxPorFranja)
    for (const f of franjas) {
      if (f.n > ctx.maxPorFranja) marcas.push({ clave: `franja:${f.id}`, nivel: "lleno", texto: `${f.nombre}: ${f.n} coches para recibir (máximo ${ctx.maxPorFranja})` });
      else if (f.n === ctx.maxPorFranja) marcas.push({ clave: `franja:${f.id}`, nivel: "justo" });
    }
  return {
    dia,
    abierto,
    horas,
    plazas,
    porValorar: a.valorar,
    sustitucion,
    franjas,
    maxPorFranja: ctx.maxPorFranja,
    nivel: nivelDe(marcas),
    avisos: marcas.flatMap((m) => (m.texto ? [m.texto] : [])),
    marcas,
  };
}

const nivelDe = (marcas: Marca[]): Nivel =>
  marcas.some((m) => m.nivel === "lleno") ? "lleno" : marcas.some((m) => m.nivel === "cerrado") ? "cerrado" : marcas.length ? "justo" : "libre";

function acumular(ctx: Contexto, desde: string, hasta: string, trabajos: Trabajo[]) {
  const acc = new Map<string, Acum>();
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) acc.set(d, vacioAcum());
  for (const w of trabajos) anadir(acc, w);
  return acc;
}

/** Carga de cada día entre `desde` y `hasta` (los días pasados no se calculan). */
export async function cargaDias(tid: string, desde: string, hasta: string): Promise<Record<string, CargaDia>> {
  const ctx = await contexto(tid);
  const ini = desde < ctx.hoy ? ctx.hoy : desde;
  if (ini > hasta) return {};
  const acc = acumular(ctx, ctx.hoy, hasta, await comprometido(tid, ctx, hasta));
  const r: Record<string, CargaDia> = {};
  for (let d = ini; d <= hasta; d = sumarDias(d, 1)) r[d] = evaluar(ctx, d, acc.get(d)!);
  return r;
}

export type Prevision = {
  /** Avisos de los días que ocuparía la cita (con ella ya contada) */
  avisos: string[];
  nivel: Nivel;
  dias: number;
  horas: Horas;
  /** Primer día con hueco (si ese día va lleno) */
  hueco: string | null;
  /** Otras franjas de ese mismo día con sitio (si solo falla la franja) */
  franjasLibres: Franja[];
  /** Coches por valorar ese día (contando esta cita si lo es) */
  porValorar: number;
};

/** Qué pasaría al dar esta cita: avisos y, si no cabe, el primer día con hueco. */
export async function prevision(tid: string, cita: CitaPrevista, excluirCitaId?: string | null): Promise<Prevision> {
  const ctx = await contexto(tid);
  const hasta = sumarDias(cita.dia > ctx.hoy ? cita.dia : ctx.hoy, 35);
  const base = acumular(ctx, ctx.hoy, hasta, await comprometido(tid, ctx, hasta, excluirCitaId));

  // Solo cuenta lo que afecta a esta cita: sus especialidades, las plazas, su franja y, si lo necesita, el coche de sustitución
  // (que el lunes la chapa vaya pasada no impide meter un cambio de aceite)
  const probar = (c: CitaPrevista) => {
    const w = trabajoCita(ctx, c);
    const toca = new Set(["plazas", ...ESPECIALIDADES.filter((e) => w.horas[e]).map((e) => `esp:${e}`), ...(c.sust ? ["sust"] : [])]);
    anadir(base, w);
    const marcas = w.dias
      .filter((d) => base.has(d))
      .flatMap((d, i) =>
        evaluar(ctx, d, base.get(d)!)
          .marcas.filter((m) => toca.has(m.clave) || (i === 0 && (m.clave === "cerrado" || m.clave === `franja:${c.franja}`)))
          .map((m) => ({ ...m, texto: m.texto && i > 0 ? `${diaCortoISO(d)}: ${m.texto}` : m.texto })),
      );
    const porValorar = base.get(c.dia)?.valorar ?? 0;
    anadir(base, w, -1);
    return { avisos: [...new Set(marcas.flatMap((m) => (m.texto ? [m.texto] : [])))], nivel: nivelDe(marcas), w, porValorar };
  };

  if (cita.dia < ctx.hoy) return { avisos: [], nivel: "libre", dias: 1, horas: cita.horas, hueco: null, franjasLibres: [], porValorar: 0 };
  const r = probar(cita);
  let hueco: string | null = null;
  let franjasLibres: Franja[] = [];
  if (r.nivel === "lleno" || r.nivel === "cerrado") {
    // ¿Solo falla la franja? Otras franjas del mismo día
    if (r.nivel === "lleno") franjasLibres = FRANJAS.map((f) => f.id).filter((f) => f !== cita.franja && probar({ ...cita, franja: f }).nivel !== "lleno");
    for (let d = sumarDias(cita.dia, 1); d <= sumarDias(hasta, -7); d = sumarDias(d, 1)) {
      if (!ctx.abiertos.includes(diaSemana(d))) continue;
      const p = probar({ ...cita, dia: d });
      if (p.nivel !== "lleno") {
        hueco = d;
        break;
      }
    }
  }
  return { avisos: r.avisos, nivel: r.nivel, dias: r.w.dias.length, horas: r.w.horas, hueco, franjasLibres, porValorar: r.porValorar };
}

const diaCortoISO = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
