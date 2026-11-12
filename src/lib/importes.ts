/*
 * Importes de una orden: líneas (mano de obra, piezas, otros), IVA y totales.
 * Todo se calcula en CÉNTIMOS ENTEROS (BigInt) para que nunca se pierda ni sobre un céntimo.
 *
 * Modos de IVA de un trabajo:
 *  - con_iva: base + IVA desglosado + total.
 *      · precios tecleados SIN IVA: base = Σ líneas; IVA = base × %; total = base + IVA.
 *      · precios con IVA INCLUIDO: total = Σ líneas (cuadra con lo tecleado); base = total / (1 + %); IVA = total − base.
 *  - exento: el precio es el importe final; se indica el motivo legal de la exención. Nunca «sin IVA» sin exención real.
 */

// Constantes BigInt (el proyecto compila para ES2017, sin literales «123n»)
const N0 = BigInt(0);
const N2 = BigInt(2);
const N10000 = BigInt(10000);
const N100000000 = BigInt(100000000);

export const ESPECIALIDADES = ["mecanica", "chapa", "pintura", "lunas"] as const;
export type Especialidad = (typeof ESPECIALIDADES)[number];
export const NOMBRE_ESPECIALIDAD: Record<Especialidad, string> = { mecanica: "Mecánica", chapa: "Chapa", pintura: "Pintura", lunas: "Lunas" };

export const TIPOS_LINEA = ["mano_obra", "pieza", "otro"] as const;
export type TipoLinea = (typeof TIPOS_LINEA)[number];
export const NOMBRE_TIPO_LINEA: Record<TipoLinea, string> = { mano_obra: "Mano de obra", pieza: "Pieza", otro: "Otro concepto" };

export type ModoIva = "con_iva" | "exento";

/** Lo mínimo para calcular una línea (los numeric de PostgreSQL llegan como texto). */
export type LineaCalc = { cantidad: number | string; precio: number | string; descuento?: number | string | null };

/** Número decimal → entero escalado (p. ej. 2,5 con 2 decimales → 250). */
function escalar(v: number | string, decimales: number): bigint {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return N0;
  return BigInt(Math.round(n * 10 ** decimales));
}

/** División entera redondeando «la mitad hacia fuera» (0,5 céntimos → 1 céntimo). */
function dividir(a: bigint, b: bigint): bigint {
  const neg = a < N0 !== b < N0;
  const [x, y] = [a < N0 ? -a : a, b < N0 ? -b : b];
  const q = (x * N2 + y) / (y * N2);
  return neg ? -q : q;
}

/** Importe de una línea en céntimos: cantidad × precio − descuento %. */
export function importeLinea(l: LineaCalc): number {
  const q = escalar(l.cantidad, 2); // ×100
  const p = escalar(l.precio, 4); // ×10.000
  const d = escalar(l.descuento ?? 0, 2); // % ×100
  // q·p está en ×10⁶; (10.000 − d) en ×10⁴ → ×10¹⁰; a céntimos (×10²) se divide entre 10⁸
  return Number(dividir(q * p * (N10000 - d), N100000000));
}

export type Totales = { base: number; iva: number; total: number; pct: number; modo: ModoIva; preciosConIva: boolean };

/** Totales en céntimos. */
export function totales(lineas: LineaCalc[], modo: ModoIva, pct: number | string, preciosConIva: boolean): Totales {
  const suma = BigInt(lineas.reduce((s, l) => s + importeLinea(l), 0));
  const pctInt = escalar(pct, 2); // 21 % → 2100
  const n = Number(pct);
  if (modo === "exento") return { base: Number(suma), iva: 0, total: Number(suma), pct: 0, modo, preciosConIva: false };
  if (preciosConIva) {
    const base = dividir(suma * N10000, N10000 + pctInt);
    return { base: Number(base), iva: Number(suma - base), total: Number(suma), pct: n, modo, preciosConIva };
  }
  const iva = dividir(suma * pctInt, N10000);
  return { base: Number(suma), iva: Number(iva), total: Number(suma + iva), pct: n, modo, preciosConIva };
}

/** Convierte un precio unitario entre «sin IVA» e «IVA incluido» (4 decimales, como se guarda). */
export function convertirPrecio(precio: number | string, pct: number | string, aConIva: boolean): number {
  const p = escalar(precio, 4);
  const f = N10000 + escalar(pct, 2);
  return Number(aConIva ? dividir(p * f, N10000) : dividir(p * N10000, f)) / 10000;
}

/** IVA efectivo de una orden: lo de la orden manda; si no, lo del cliente y el taller. */
export function ivaDeOT(
  ot: { ivaModo: ModoIva | null; ivaPct: string | null; motivoExencion: string | null; preciosConIva: boolean },
  cliente: { exentoIva: boolean; motivoExencion: string | null },
  taller: { ivaDefecto: string },
) {
  const modo: ModoIva = ot.ivaModo ?? (cliente.exentoIva ? "exento" : "con_iva");
  return {
    modo,
    pct: ot.ivaPct ?? taller.ivaDefecto,
    motivo: ot.motivoExencion ?? cliente.motivoExencion ?? "",
    preciosConIva: modo === "con_iva" && ot.preciosConIva,
  };
}

/** Lee un número tecleado en español: «2,5», «1.234,56», «45». Devuelve NaN si no es válido. */
export function leerDecimal(v: unknown): number {
  let s = String(v ?? "").trim().replace(/\s|€|%/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const EUROS = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
/** Céntimos → «1.234,56 €». */
export const fmtEuros = (centimos: number) => EUROS.format(centimos / 100);
/** Precio unitario (euros, hasta 4 decimales guardados) → «45,00 €» (o «24,7934 €» si hace falta). */
export function fmtPrecio(euros: number | string) {
  const n = Number(euros);
  const dec = Math.round(n * 100) / 100 === Math.round(n * 10000) / 10000 ? 2 : 4;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: dec }).format(n);
}
/** Número → «2,5» (sin ceros de sobra). */
export const fmtCantidad = (v: number | string) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Number(v));
