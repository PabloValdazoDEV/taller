// Traduce el estado interno de una orden a lo que se le cuenta al cliente (teléfono, enlace de seguimiento).
// Los estados internos (Chapa, Pintura, Montaje…) se agrupan para no confundir al cliente.

import { diaISO, fmtFecha } from "./formato";

export type FaseCliente = "recibido" | "diagnostico" | "aprobacion" | "peritaje" | "piezas" | "reparacion" | "calidad" | "listo" | "entregado";

export const FASE_CLIENTE: Record<FaseCliente, { titulo: string; color: string }> = {
  recibido: { titulo: "Recibido en el taller", color: "#475569" },
  diagnostico: { titulo: "En diagnóstico", color: "#0369a1" },
  aprobacion: { titulo: "Pendiente de su aprobación", color: "#7c3aed" },
  peritaje: { titulo: "Pendiente de la aseguradora", color: "#7c3aed" },
  piezas: { titulo: "Esperando piezas", color: "#b45309" },
  reparacion: { titulo: "En reparación", color: "#0369a1" },
  calidad: { titulo: "Control de calidad final", color: "#0f766e" },
  listo: { titulo: "Listo para recoger", color: "#047857" },
  entregado: { titulo: "Entregado", color: "#047857" },
};

type OtParaCliente = {
  estadoNombre: string;
  estadoMarca: string | null;
  requiereAprobacion: boolean;
  fechaPrevista: string | null;
  cerradaEn?: Date | null;
  datosSiniestro?: { companiaNombre?: string } | null;
};

export function faseCliente(o: OtParaCliente): FaseCliente {
  const n = o.estadoNombre.toLowerCase();
  if (o.cerradaEn || o.estadoMarca === "final") return "entregado";
  if (o.estadoMarca === "listo") return "listo";
  if (o.requiereAprobacion) return /autoriza/.test(n) || o.datosSiniestro?.companiaNombre ? "peritaje" : "aprobacion";
  if (/perit|autoriza|valoraci/.test(n)) return "peritaje";
  if (/pieza|esperando/.test(n)) return "piezas";
  if (/diagn/.test(n)) return "diagnostico";
  if (/calidad/.test(n)) return "calidad";
  if (/recepcion/.test(n)) return "recibido";
  return "reparacion";
}

/** Frase lista para leer al cliente por teléfono. */
export function queDecirle(
  o: OtParaCliente & { incidenciasCliente?: { tipo: string; descripcion: string; nuevaFecha: string | null }[] },
  hoyISO: string,
  { sinFecha = false }: { sinFecha?: boolean } = {},
) {
  const fase = faseCliente(o);
  const partes: string[] = [];
  const cia = o.datosSiniestro?.companiaNombre;
  switch (fase) {
    case "entregado":
      return `Se entregó el ${fmtFecha(o.cerradaEn ?? null)}.`;
    case "listo":
      return "Ya está listo: puede pasar a recogerlo.";
    case "aprobacion":
      partes.push("Estamos esperando que nos confirme el presupuesto para seguir.");
      break;
    case "peritaje":
      partes.push(cia ? `Estamos esperando al perito o la autorización de ${cia}.` : "Estamos esperando la autorización de la compañía.");
      break;
    case "piezas":
      partes.push("Estamos esperando piezas.");
      break;
    case "diagnostico":
      partes.push("Lo estamos revisando para ver qué tiene.");
      break;
    case "calidad":
      partes.push("Está terminado; le estamos haciendo la revisión final.");
      break;
    case "recibido":
      partes.push("Lo hemos recibido y entra en breve a taller.");
      break;
    default:
      partes.push(/reparaci/i.test(o.estadoNombre) ? "Está en reparación." : `Está en reparación (${o.estadoNombre.toLowerCase()}).`);
  }
  const retraso = o.incidenciasCliente?.find((i) => i.tipo === "retraso_piezas" && i.nuevaFecha);
  if (sinFecha) {
    if (retraso) partes.push("Ha habido un retraso de piezas.");
  } else if (retraso) partes.push(`Ha habido un retraso de piezas; la nueva fecha es el ${fmtFecha(retraso.nuevaFecha)}.`);
  else if (o.fechaPrevista) partes.push(o.fechaPrevista < hoyISO ? `Iba para el ${fmtFecha(o.fechaPrevista)} y va con retraso.` : `Fecha prevista: ${fmtFecha(o.fechaPrevista)}.`);
  if (o.incidenciasCliente?.some((i) => i.tipo === "averia_adicional")) partes.push("Hemos encontrado algo más que hay que comentarle.");
  return partes.join(" ");
}

/** Hoy en formato AAAA-MM-DD, en hora de Madrid (el servidor puede estar en UTC). */
export const hoyISO = () => diaISO();
