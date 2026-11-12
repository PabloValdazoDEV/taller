"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { tallerActual } from "@/lib/taller";
import { infoCliente } from "@/lib/auth";
import { COOKIE_SESION, MAX_AGE_SESION, firmarSesion, longitudPin } from "@/lib/session-token";

/*
 * Freno a fuerza bruta de PIN, por usuario y por IP (en memoria: la app corre en un único proceso).
 * El intento se cuenta ANTES de comprobar el PIN (sin «await» entre medias), así que lanzar muchas
 * peticiones a la vez no lo esquiva. Superado el margen, cada fallo duplica la espera (1, 2, 4… min, máx. 1 h).
 */
// Fallos permitidos antes de esperar: por usuario, y por IP (la tablet de recepción la comparte todo el equipo)
const LIBRES = { u: 5, ip: 20 };
const intentos = new Map<string, { n: number; hasta: number; ultimo: number }>();

function esperaRestante(clave: string) {
  const r = intentos.get(clave);
  return r && r.hasta > Date.now() ? r.hasta - Date.now() : 0;
}
function contarIntento(clave: string) {
  const libres = clave.startsWith("ip:") ? LIBRES.ip : LIBRES.u;
  const ahora = Date.now();
  const prev = intentos.get(clave);
  const n = prev && ahora - prev.ultimo < 24 * 3_600_000 ? prev.n + 1 : 1; // se olvida tras 24 h sin fallos
  const hasta = n > libres ? ahora + Math.min(60_000 * 2 ** (n - libres - 1), 3_600_000) : 0;
  intentos.set(clave, { n, hasta, ultimo: ahora });
  if (intentos.size > 5000) for (const [k, v] of intentos) if (ahora - v.ultimo > 24 * 3_600_000) intentos.delete(k);
}

export async function entrarConPin(usuarioId: string, pin: string): Promise<{ error?: string }> {
  const { ip } = await infoCliente();
  const claves = [`u:${usuarioId}`, `ip:${ip}`];
  const espera = Math.max(...claves.map(esperaRestante));
  if (espera > 0) return { error: `Demasiados intentos. Espera ${Math.ceil(espera / 60_000)} min.` };
  claves.forEach(contarIntento); // antes del primer await que compara el PIN

  const taller = await tallerActual();
  if (!taller) return { error: "Taller no encontrado" };
  const u = await db.query.usuarios.findFirst({
    where: and(eq(t.usuarios.id, usuarioId), eq(t.usuarios.tallerId, taller.id), eq(t.usuarios.activo, true)),
  });
  if (!u || !new RegExp(`^\\d{${longitudPin(u.rol)}}$`).test(pin) || !(await bcrypt.compare(pin, u.pinHash))) return { error: "PIN incorrecto" };
  claves.forEach((c) => intentos.delete(c));

  const token = await firmarSesion({ uid: u.id, tid: taller.id, slug: taller.slug, rol: u.rol, nombre: u.nombre });
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SESION,
    path: "/",
  });
  redirect(u.rol === "mecanico" ? "/mis-trabajos" : "/");
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/login");
}
