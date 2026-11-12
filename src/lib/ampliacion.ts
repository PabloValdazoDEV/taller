/*
 * Ampliación de presupuesto (desvío): qué cambia respecto al presupuesto ya aceptado.
 * Las copias de líneas llevan `lineaId` (la línea de la orden de la que salen); en copias antiguas
 * sin él se emparejan por tipo + referencia + descripción.
 */
import type { LineaPresupuesto } from "@/db/schema";

export type Cambio = { tipo: "nueva" | "cambia" | "quita"; linea: LineaPresupuesto; antes?: LineaPresupuesto };

const clave = (l: LineaPresupuesto) =>
  [l.tipo, l.especialidad ?? "", (l.referencia ?? "").trim().toLowerCase(), l.descripcion.trim().toLowerCase()].join("|");

const igual = (a: LineaPresupuesto, b: LineaPresupuesto) =>
  clave(a) === clave(b) &&
  Number(a.cantidad) === Number(b.cantidad) &&
  Number(a.precio) === Number(b.precio) &&
  Number(a.descuento) === Number(b.descuento) &&
  a.importe === b.importe;

/** Líneas nuevas, cambiadas y quitadas de `ahora` respecto a `antes` (el presupuesto aceptado). */
export function cambiosAmpliacion(antes: LineaPresupuesto[], ahora: LineaPresupuesto[]): Cambio[] {
  const libres = antes.map((l, i) => ({ l, i }));
  const pareja = new Map<number, LineaPresupuesto>();
  const tomar = (j: number, pred: (a: LineaPresupuesto) => boolean) => {
    const k = libres.findIndex(({ l }) => pred(l));
    if (k < 0) return;
    pareja.set(j, libres[k].l);
    libres.splice(k, 1);
  };
  // 1) por línea de origen; 2) por contenido, solo si a alguna de las dos le falta el origen
  ahora.forEach((l, j) => l.lineaId && tomar(j, (a) => a.lineaId === l.lineaId));
  ahora.forEach((l, j) => !pareja.has(j) && tomar(j, (a) => (!a.lineaId || !l.lineaId) && clave(a) === clave(l)));

  const cambios: Cambio[] = [];
  ahora.forEach((l, j) => {
    const a = pareja.get(j);
    if (!a) cambios.push({ tipo: "nueva", linea: l });
    else if (!igual(a, l)) cambios.push({ tipo: "cambia", linea: l, antes: a });
  });
  for (const { l } of libres) cambios.push({ tipo: "quita", linea: l });
  return cambios;
}

/** Horas de mano de obra de unas líneas. */
export const horasManoObra = (lineas: Pick<LineaPresupuesto, "tipo" | "cantidad">[]) =>
  lineas.filter((l) => l.tipo === "mano_obra").reduce((s, l) => s + (Number(l.cantidad) || 0), 0);

/** Horas de más que supone una ampliación (nunca negativas). */
export function horasAmpliacion(cambios: Cambio[]) {
  const h = cambios.reduce((s, c) => {
    if (c.linea.tipo !== "mano_obra") return s;
    const n = Number(c.linea.cantidad) || 0;
    return s + (c.tipo === "nueva" ? n : c.tipo === "quita" ? -n : n - (Number(c.antes?.cantidad) || 0));
  }, 0);
  return Math.max(0, Math.round(h * 100) / 100);
}

/** «4 h», «1,5 h», «30 min» */
export function fmtHoras(h: number | string | null | undefined) {
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1) return `${Math.round(n * 60)} min`;
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n)} h`;
}
