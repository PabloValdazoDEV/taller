// Validación y utilidades de daños marcados sobre la silueta (compartido por recepción y coches de sustitución).
import { z } from "zod";
import type { Dano } from "@/db/schema";

export const DanosZ = z
  .array(
    z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      tipo: z.string().min(1).max(40),
      nota: z.string().max(200).optional(),
      vista: z.enum(["superior", "izquierdo", "derecho", "frontal", "trasera"]).optional(),
    }),
  )
  .max(100);

const mismo = (a: Dano, b: Dano) => a.x === b.x && a.y === b.y && a.tipo === b.tipo && (a.vista ?? "superior") === (b.vista ?? "superior");

/** Daños de `despues` que no estaban en `antes`. */
export function danosNuevos(antes: Dano[], despues: Dano[]) {
  return despues.filter((d) => !antes.some((a) => mismo(a, d)));
}

/** Añade a la nota de los daños nuevos de dónde vienen (p. ej. «Nuevo en devolución · Antonio · 11/11/2026»). */
export function marcarOrigen(antes: Dano[], despues: Dano[], origen: string): Dano[] {
  return despues.map((d) => (antes.some((a) => mismo(a, d)) ? d : { ...d, nota: d.nota ? `${d.nota} · ${origen}` : origen }));
}
