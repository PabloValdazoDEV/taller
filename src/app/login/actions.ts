"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { tallerActual } from "@/lib/taller";
import { COOKIE_SESION, MAX_AGE_SESION, firmarSesion } from "@/lib/session-token";

// Freno simple a fuerza bruta de PIN (en memoria; suficiente para un servidor único).
const intentos = new Map<string, { n: number; hasta: number }>();

export async function entrarConPin(usuarioId: string, pin: string): Promise<{ error?: string }> {
  const taller = await tallerActual();
  if (!taller) return { error: "Taller no encontrado" };

  const bloqueo = intentos.get(usuarioId);
  if (bloqueo && bloqueo.n >= 5 && bloqueo.hasta > Date.now()) {
    return { error: "Demasiados intentos. Espera un minuto." };
  }

  const u = await db.query.usuarios.findFirst({
    where: and(eq(t.usuarios.id, usuarioId), eq(t.usuarios.tallerId, taller.id), eq(t.usuarios.activo, true)),
  });
  if (!u || !(await bcrypt.compare(pin, u.pinHash))) {
    const prev = intentos.get(usuarioId);
    intentos.set(usuarioId, { n: (prev?.n ?? 0) + 1, hasta: Date.now() + 60_000 });
    return { error: "PIN incorrecto" };
  }
  intentos.delete(usuarioId);

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
