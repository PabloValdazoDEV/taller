/*
 * Capacidad del taller para dar citas: reglas y valores por defecto (sin dependencias de servidor).
 * El cálculo de la carga de cada día está en src/lib/carga.ts. Todo es orientativo: solo avisa, nunca bloquea.
 */
import { ESPECIALIDADES, NOMBRE_ESPECIALIDAD, type Especialidad } from "./importes";
import type { TallerConfig } from "@/db/schema";

export type Horas = Partial<Record<Especialidad, number>>;

/** Horas de trabajo de un coche al día: sirve para saber cuántos días ocupa una plaza. */
export const JORNADA = 8;

export const DIAS_SEMANA = [
  { n: 1, corto: "L", nombre: "Lunes" },
  { n: 2, corto: "M", nombre: "Martes" },
  { n: 3, corto: "X", nombre: "Miércoles" },
  { n: 4, corto: "J", nombre: "Jueves" },
  { n: 5, corto: "V", nombre: "Viernes" },
  { n: 6, corto: "S", nombre: "Sábado" },
  { n: 7, corto: "D", nombre: "Domingo" },
] as const;
export const DIAS_ABIERTOS_BASE = [1, 2, 3, 4, 5];

/**
 * Horas que suele ocupar cada tipo de trabajo si el taller no ha puesto las suyas (por código del tipo).
 * Vacío = «por valorar»: no se sabe hasta verlo (siniestros, averías); ocupa plaza y recepción pero no suma horas
 * hasta que la orden tenga su mano de obra (del perito o del presupuesto).
 */
export const HORAS_TIPO_BASE: Record<string, Horas> = {
  mantenimiento: { mecanica: 1.5 },
  averia: {},
  siniestro: {},
  renting: { mecanica: 1.5 },
  lunas: { lunas: 1.5 },
  neumaticos: { mecanica: 1 },
  garantia: { mecanica: 2 },
};
const HORAS_SIN_TIPO: Horas = {};

/** Horas por defecto de un tipo de trabajo: las del taller o, si no las ha puesto, las de base. Vacío = por valorar. */
export function horasTipo(cfg: TallerConfig, tipo: { id: string; codigo: string } | null | undefined): Horas {
  if (!tipo) return HORAS_SIN_TIPO;
  return cfg.capacidad?.horasPorTipo?.[tipo.id] ?? HORAS_TIPO_BASE[tipo.codigo] ?? HORAS_SIN_TIPO;
}

export const totalHoras = (h: Horas) => ESPECIALIDADES.reduce((s, e) => s + (h[e] ?? 0), 0);
export const hayHoras = (h: Horas | null | undefined) => !!h && totalHoras(h) > 0;

/** Deja solo especialidades conocidas con horas entre 0 y 200 (redondeadas a 1/4 de hora). */
export function limpiarHoras(v: unknown): Horas {
  const r: Horas = {};
  if (!v || typeof v !== "object") return r;
  for (const e of ESPECIALIDADES) {
    const n = Number((v as Record<string, unknown>)[e]);
    if (Number.isFinite(n) && n > 0 && n <= 200) r[e] = Math.round(n * 4) / 4;
  }
  return r;
}

/** «7,5» */
export const fmtH = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-ES");

/** «Chapa 6 h · Pintura 4 h» */
export const textoHoras = (h: Horas) =>
  ESPECIALIDADES.filter((e) => h[e])
    .map((e) => `${NOMBRE_ESPECIALIDAD[e]} ${fmtH(h[e]!)} h`)
    .join(" · ");

/** Suma días a una fecha AAAA-MM-DD (aritmética de calendario, sin zona horaria). */
export function sumarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 1 = lunes … 7 = domingo */
export const diaSemana = (dia: string) => ((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** «Chapa y pintura» (sin especialidades: mecánica) */
export function nombreEspecialidades(esps: readonly string[] | null | undefined) {
  const n = ESPECIALIDADES.filter((e) => esps?.includes(e)).map((e) => NOMBRE_ESPECIALIDAD[e].toLowerCase());
  const t = n.length ? (n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n.at(-1)}` : n[0]) : "mecánica";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
