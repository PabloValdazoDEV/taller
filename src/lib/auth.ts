import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { COOKIE_SESION, verificarSesion, type Sesion } from "./session-token";
import { slugDesdeHost } from "./tenant";
import { inicioDe, tiene, type Permiso } from "./puestos";

export const getSesion = cache(async (): Promise<Sesion | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  const s = await verificarSesion(token);
  if (!s) return null;
  // La sesión solo vale para el taller del subdominio actual
  const slug = slugDesdeHost((await headers()).get("host"));
  if (s.slug !== slug) return null;
  // El usuario debe seguir existiendo y activo en ese taller (usuario dado de baja, taller borrado…)
  const [u] = await db
    .select({ puestos: t.usuarios.puestos, nombre: t.usuarios.nombre })
    .from(t.usuarios)
    .where(and(eq(t.usuarios.id, s.uid), eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.activo, true)));
  if (!u) return null;
  // Puestos y nombre siempre actualizados desde la BD (un cambio de puesto se aplica al momento)
  return { uid: s.uid, tid: s.tid, slug: s.slug, puestos: u.puestos, nombre: u.nombre };
});

/** Exige sesión (y opcionalmente un permiso). Redirige a /login si no la hay. */
export async function requireSesion(permiso?: Permiso): Promise<Sesion> {
  const s = await getSesion();
  if (!s) redirect("/login");
  if (permiso && !tiene(s.puestos, permiso)) redirect(inicioDe(s.puestos));
  return s;
}

export async function infoCliente() {
  const h = await headers();
  return {
    // x-real-ip lo pone nginx y el cliente no puede falsearlo; x-forwarded-for sí (se usa el último salto)
    ip: h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "local",
    userAgent: h.get("user-agent") ?? "",
  };
}
