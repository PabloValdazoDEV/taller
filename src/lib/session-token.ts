// Firma/verificación de la sesión (sin dependencias de Node: se usa también en middleware).
import { SignJWT, jwtVerify } from "jose";

import type { Puesto } from "./puestos";

export type Sesion = { uid: string; tid: string; slug: string; puestos: Puesto[]; nombre: string };

export const COOKIE_SESION = "taller_sesion";

const DURACION_H = 12;

/** Secreto de la app comprobado (nunca se firma nada con un secreto vacío o corto). */
export function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET no definido o demasiado corto (mín. 32)");
  return s;
}
const clave = () => new TextEncoder().encode(secreto());

export async function firmarSesion(s: Sesion) {
  return new SignJWT(s)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_H}h`)
    .sign(clave());
}

export async function verificarSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    return payload as unknown as Sesion;
  } catch {
    return null;
  }
}

export const MAX_AGE_SESION = DURACION_H * 3600;
