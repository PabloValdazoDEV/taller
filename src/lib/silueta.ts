// Dibujos del vehículo para marcar daños. Se describen como datos para pintarlos igual
// en pantalla (SVG) y en los PDF (react-pdf), así las marcas coinciden en ambos sitios.
import type { Dano, Vista } from "@/db/schema";

export type Estilo = "carroceria" | "cristal" | "rueda" | "llanta" | "linea" | "faro" | "piloto" | "rejilla" | "matricula" | "retrovisor";
export type Forma =
  | { t: "path"; d: string; e: Estilo }
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; e: Estilo }
  | { t: "circle"; cx: number; cy: number; r: number; e: Estilo };

export type DefVista = { clave: Vista; nombre: string; corto: string; w: number; h: number; formas: Forma[]; espejo?: boolean; etiquetas?: [string, string] };

export const ESTILOS: Record<Estilo, { fill: string; stroke?: string; sw?: number; dash?: string }> = {
  carroceria: { fill: "#f8fafc", stroke: "#475569", sw: 2.5 },
  cristal: { fill: "#bae6fd", stroke: "#64748b", sw: 1 },
  rueda: { fill: "#334155" },
  llanta: { fill: "#cbd5e1", stroke: "#94a3b8", sw: 1 },
  linea: { fill: "none", stroke: "#94a3b8", sw: 1.2 },
  faro: { fill: "#fef9c3", stroke: "#a16207", sw: 1 },
  piloto: { fill: "#fecaca", stroke: "#b91c1c", sw: 1 },
  rejilla: { fill: "#475569", stroke: "#334155", sw: 1 },
  matricula: { fill: "#ffffff", stroke: "#334155", sw: 1 },
  retrovisor: { fill: "#cbd5e1", stroke: "#64748b", sw: 1 },
};

// ── Vista superior (frontal arriba) ─────────────────────────────
const SUPERIOR: Forma[] = [
  { t: "rect", x: 28, y: 72, w: 14, h: 48, r: 4, e: "rueda" },
  { t: "rect", x: 158, y: 72, w: 14, h: 48, r: 4, e: "rueda" },
  { t: "rect", x: 28, y: 280, w: 14, h: 48, r: 4, e: "rueda" },
  { t: "rect", x: 158, y: 280, w: 14, h: 48, r: 4, e: "rueda" },
  { t: "rect", x: 24, y: 128, w: 18, h: 10, r: 3, e: "retrovisor" },
  { t: "rect", x: 158, y: 128, w: 18, h: 10, r: 3, e: "retrovisor" },
  { t: "path", d: "M70 20 Q100 12 130 20 Q160 28 160 70 L160 340 Q160 380 130 384 Q100 388 70 384 Q40 380 40 340 L40 70 Q40 28 70 20 Z", e: "carroceria" },
  { t: "path", d: "M60 40 Q100 30 140 40", e: "linea" },
  { t: "path", d: "M54 122 Q100 108 146 122 L138 160 Q100 152 62 160 Z", e: "cristal" },
  { t: "path", d: "M62 166 L138 166 L138 282 L62 282 Z", e: "linea" },
  { t: "path", d: "M62 290 L138 290 L146 326 Q100 336 54 326 Z", e: "cristal" },
  { t: "path", d: "M40 200 L60 200 M140 200 L160 200 M40 240 L60 240 M140 240 L160 240", e: "linea" },
];

// ── Lateral (frontal a la izquierda). El derecho es el mismo dibujo en espejo. ──
const LATERAL: Forma[] = [
  { t: "path", d: "M30 126 L28 104 Q30 92 48 88 L118 78 Q140 60 160 46 Q172 38 190 38 L262 38 Q282 38 296 52 L330 80 L368 88 Q382 92 382 106 L382 126 Q382 134 372 134 L342 134 A30 30 0 0 0 278 134 L127 134 A30 30 0 0 0 63 134 L38 134 Q30 134 30 126 Z", e: "carroceria" },
  { t: "path", d: "M130 80 L162 50 Q170 44 182 44 L209 44 L209 80 Z", e: "cristal" },
  { t: "path", d: "M216 44 L260 44 Q276 44 288 56 L312 80 L216 80 Z", e: "cristal" },
  { t: "path", d: "M212 42 L212 128 M128 82 Q124 104 128 128 M300 84 Q306 104 302 126 M44 110 L376 110", e: "linea" },
  { t: "rect", x: 178, y: 90, w: 16, h: 4, r: 2, e: "linea" },
  { t: "rect", x: 262, y: 90, w: 16, h: 4, r: 2, e: "linea" },
  { t: "path", d: "M30 98 L56 94 L54 106 L30 108 Z", e: "faro" },
  { t: "path", d: "M368 92 L382 98 L382 110 L366 106 Z", e: "piloto" },
  { t: "path", d: "M128 78 L116 70 L110 78 L124 84 Z", e: "retrovisor" },
  { t: "circle", cx: 95, cy: 134, r: 26, e: "rueda" },
  { t: "circle", cx: 95, cy: 134, r: 13, e: "llanta" },
  { t: "circle", cx: 310, cy: 134, r: 26, e: "rueda" },
  { t: "circle", cx: 310, cy: 134, r: 13, e: "llanta" },
];

// ── Frontal (visto desde delante: la izquierda del dibujo es el lado DERECHO del coche) ──
const FRONTAL: Forma[] = [
  { t: "rect", x: 50, y: 166, w: 34, h: 32, r: 6, e: "rueda" },
  { t: "rect", x: 216, y: 166, w: 34, h: 32, r: 6, e: "rueda" },
  { t: "path", d: "M40 170 L40 122 Q42 102 60 98 L80 60 Q86 48 102 46 L198 46 Q214 48 220 60 L240 98 Q258 102 260 122 L260 170 Q260 182 248 182 L52 182 Q40 182 40 170 Z", e: "carroceria" },
  { t: "path", d: "M88 94 L104 56 L196 56 L212 94 Z", e: "cristal" },
  { t: "path", d: "M60 98 L40 90 L36 102 L56 106 Z", e: "retrovisor" },
  { t: "path", d: "M240 98 L260 90 L264 102 L244 106 Z", e: "retrovisor" },
  { t: "path", d: "M52 114 L100 118 L96 132 L50 128 Z", e: "faro" },
  { t: "path", d: "M248 114 L200 118 L204 132 L250 128 Z", e: "faro" },
  { t: "rect", x: 110, y: 120, w: 80, h: 24, r: 6, e: "rejilla" },
  { t: "rect", x: 120, y: 152, w: 60, h: 14, r: 2, e: "matricula" },
  { t: "path", d: "M48 148 L104 148 M196 148 L252 148", e: "linea" },
];

// ── Trasera (vista desde detrás: la izquierda del dibujo es el lado IZQUIERDO del coche) ──
const TRASERA: Forma[] = [
  { t: "rect", x: 50, y: 166, w: 34, h: 32, r: 6, e: "rueda" },
  { t: "rect", x: 216, y: 166, w: 34, h: 32, r: 6, e: "rueda" },
  { t: "path", d: "M40 170 L40 122 Q42 102 60 98 L80 60 Q86 48 102 46 L198 46 Q214 48 220 60 L240 98 Q258 102 260 122 L260 170 Q260 182 248 182 L52 182 Q40 182 40 170 Z", e: "carroceria" },
  { t: "path", d: "M92 94 L106 58 L194 58 L208 94 Z", e: "cristal" },
  { t: "path", d: "M48 112 L94 114 L92 130 L48 130 Z", e: "piloto" },
  { t: "path", d: "M252 112 L206 114 L208 130 L252 130 Z", e: "piloto" },
  { t: "rect", x: 116, y: 124, w: 68, h: 16, r: 2, e: "matricula" },
  { t: "path", d: "M60 100 L240 100 M48 156 L252 156", e: "linea" },
];

export const VISTAS: DefVista[] = [
  { clave: "superior", nombre: "Vista superior", corto: "Arriba", w: 200, h: 400, formas: SUPERIOR, etiquetas: ["DELANTE", "DETRÁS"] },
  { clave: "izquierdo", nombre: "Lateral izquierdo (conductor)", corto: "Izquierdo", w: 410, h: 170, formas: LATERAL, etiquetas: ["DELANTE", "DETRÁS"] },
  { clave: "derecho", nombre: "Lateral derecho (copiloto)", corto: "Derecho", w: 410, h: 170, formas: LATERAL, espejo: true, etiquetas: ["DETRÁS", "DELANTE"] },
  { clave: "frontal", nombre: "Frontal", corto: "Delante", w: 300, h: 210, formas: FRONTAL, etiquetas: ["DERECHO", "IZQUIERDO"] },
  { clave: "trasera", nombre: "Trasera", corto: "Detrás", w: 300, h: 210, formas: TRASERA, etiquetas: ["IZQUIERDO", "DERECHO"] },
];

export const vistaDe = (d: Dano): Vista => d.vista ?? "superior";
export const defVista = (v: Vista) => VISTAS.find((x) => x.clave === v)!;

/** Descripción legible de la zona del daño a partir de la vista y la posición. */
export function zonaDano(d: Dano): string {
  const v = vistaDe(d);
  if (v === "superior") {
    const fila = d.y < 18 ? "frontal" : d.y < 40 ? "delantera" : d.y < 72 ? "central" : d.y < 88 ? "trasera" : "zaga";
    const lado = d.x < 35 ? "izquierda" : d.x > 65 ? "derecha" : "centro";
    return `${fila} ${lado} (arriba)`;
  }
  if (v === "izquierdo" || v === "derecho") {
    const xr = v === "izquierdo" ? d.x : 100 - d.x; // 0 = delante
    const pos = xr < 33 ? "delantera" : xr < 66 ? "central" : "trasera";
    const alt = d.y < 47 ? "ventanillas/techo" : d.y < 72 ? "puertas" : "bajos/llantas";
    return `lateral ${v === "izquierdo" ? "izq." : "der."} ${pos}, ${alt}`;
  }
  const izqDibujo = d.x < 40;
  const derDibujo = d.x > 60;
  const lado = !izqDibujo && !derDibujo ? "centro" : v === "frontal" ? (izqDibujo ? "lado derecho" : "lado izquierdo") : izqDibujo ? "lado izquierdo" : "lado derecho";
  const alt = d.y < 47 ? (v === "frontal" ? "parabrisas" : "luneta") : d.y < 70 ? (v === "frontal" ? "capó/faros" : "portón/pilotos") : "paragolpes";
  return `${v === "frontal" ? "frontal" : "trasera"} ${lado}, ${alt}`;
}
