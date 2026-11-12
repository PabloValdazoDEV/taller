"use server";

import { revalidatePath } from "next/cache";
import { validarFirma } from "@/lib/pdf/generar";
import { decidirPresupuesto, verificarTokenPresupuesto } from "@/lib/presupuestos";

type R = { error?: string };

/** El cliente acepta el presupuesto desde su móvil (con nombre y firma). */
export async function aceptarPorEnlace(token: string, firmante: string, firmaPng: string): Promise<R> {
  const v = await verificarTokenPresupuesto(token);
  if (!v) return { error: "El enlace no es válido o ha caducado. Pida al taller un presupuesto actualizado." };
  if (firmante.trim().length < 2) return { error: "Escriba su nombre" };
  const firma = validarFirma(firmaPng);
  if (!firma) return { error: "Falta su firma" };
  const r = await decidirPresupuesto({ tid: v.tallerId, presupuestoId: v.id, decision: "aprobado", via: "enlace", nombre: firmante.trim(), firmaPng: firma, usuario: null });
  revalidatePath(`/p/${token}`);
  return r.error ? { error: r.error } : {};
}

/** El cliente indica que no acepta el presupuesto. */
export async function rechazarPorEnlace(token: string, nombre: string, motivo: string): Promise<R> {
  const v = await verificarTokenPresupuesto(token);
  if (!v) return { error: "El enlace no es válido o ha caducado." };
  const r = await decidirPresupuesto({ tid: v.tallerId, presupuestoId: v.id, decision: "rechazado", via: "enlace", nombre: nombre.trim() || "Cliente", nota: motivo, usuario: null });
  revalidatePath(`/p/${token}`);
  return r.error ? { error: r.error } : {};
}
