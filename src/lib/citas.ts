/*
 * Citas de entrada: el cliente trae el coche un día «a primera hora», «por la tarde»… o a una hora exacta.
 * Sin dependencias de servidor: se usa también en el cliente.
 */
import { ZONA, diaISO, fmtHora } from "./formato";

export const FRANJAS = [
  { id: "primera_hora", nombre: "A primera hora", hora: "08:00" },
  { id: "manana", nombre: "Por la mañana", hora: "10:00" },
  { id: "mediodia", nombre: "A mediodía", hora: "13:00" },
  { id: "tarde", nombre: "Por la tarde", hora: "16:30" },
  { id: "ultima_hora", nombre: "A última hora", hora: "19:00" },
] as const;
export type Franja = (typeof FRANJAS)[number]["id"];
export const esFranja = (v: unknown): v is Franja => FRANJAS.some((f) => f.id === v);
export const franja = (id: string | null | undefined) => FRANJAS.find((f) => f.id === id) ?? null;

/** «a primera hora» / «a las 9:30» */
export function cuando(c: { fechaHora: Date | string; franja: string | null }) {
  const f = franja(c.franja);
  if (f) return f.nombre.charAt(0).toLowerCase() + f.nombre.slice(1);
  const h = fmtHora(c.fechaHora);
  return `a la${h.startsWith("01:") ? "" : "s"} ${h.replace(/^0(\d)/, "$1")}`;
}

/** «lunes 17/11» (o «hoy» / «mañana») */
export function diaCorto(d: Date | string, relativo = true) {
  const dia = diaISO(new Date(d));
  if (relativo && dia === diaISO()) return "hoy";
  if (relativo && dia === diaISO(new Date(Date.now() + 86_400_000))) return "mañana";
  const semana = new Date(d).toLocaleDateString("es-ES", { weekday: "long", timeZone: ZONA });
  return `${semana} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** «el lunes 17/11 a primera hora» (para el mensaje al cliente: sin «hoy/mañana» relativos ambiguos) */
export const textoCita = (c: { fechaHora: Date | string; franja: string | null }) => `el ${diaCorto(c.fechaHora, false)} ${cuando(c)}`;

/** Franja en la que cae una hora exacta («09:15» → a primera hora), para contar recepciones por franja. */
export function franjaDeHora(hhmm: string): Franja {
  if (hhmm < "09:30") return "primera_hora";
  if (hhmm < "12:00") return "manana";
  if (hhmm < "15:00") return "mediodia";
  if (hhmm < "18:00") return "tarde";
  return "ultima_hora";
}
