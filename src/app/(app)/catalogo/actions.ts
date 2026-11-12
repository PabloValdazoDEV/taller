"use server";

import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

/** Marcas/modelos que el taller ha creado (se suman al catálogo base). */
export async function catalogoPersonalizado() {
  const s = await requireSesion();
  return db
    .select({ marca: t.catalogoVehiculos.marca, modelo: t.catalogoVehiculos.modelo })
    .from(t.catalogoVehiculos)
    .where(eq(t.catalogoVehiculos.tallerId, s.tid))
    .orderBy(asc(t.catalogoVehiculos.marca), asc(t.catalogoVehiculos.modelo));
}

const limpiar = (v: string) => v.trim().replace(/\s+/g, " ").slice(0, 60);

export async function crearEnCatalogo(marca: string, modelo?: string): Promise<{ error?: string }> {
  const s = await requireSesion("oficina");
  const m = limpiar(marca);
  const mo = modelo ? limpiar(modelo) : null;
  if (m.length < 2 || (modelo !== undefined && (!mo || mo.length < 1))) return { error: "Nombre demasiado corto" };
  await db.insert(t.catalogoVehiculos).values({ tallerId: s.tid, marca: m, modelo: mo, creadoPor: s.uid }).onConflictDoNothing();
  // Al crear un modelo de una marca nueva, la marca también queda registrada
  if (mo) await db.insert(t.catalogoVehiculos).values({ tallerId: s.tid, marca: m, modelo: null, creadoPor: s.uid }).onConflictDoNothing();
  await auditar(s, "crear_catalogo", "catalogo", null, { marca: m, modelo: mo });
  return {};
}
