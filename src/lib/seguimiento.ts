import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { secreto } from "./session-token";
import { urlBase } from "./enlaces";

/*
 * Enlace de seguimiento para el cliente (/s/<token>): se envía en la recepción junto al resguardo.
 * Token firmado con su propia clave (no sirve para documentos ni presupuestos) y válido un año,
 * para que tras la entrega siga mostrando el acta y la garantía.
 */
const clave = () => new TextEncoder().encode(secreto() + ":seguimiento");

export async function tokenSeguimiento(otId: string, tallerId: string) {
  return new SignJWT({ o: otId, t: tallerId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("365d").sign(clave());
}

export async function verificarTokenSeguimiento(token: string): Promise<{ otId: string; tallerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, clave());
    return { otId: String(payload.o), tallerId: String(payload.t) };
  } catch {
    return null;
  }
}

export async function enlaceSeguimiento(otId: string, tallerId: string) {
  return `${await urlBase()}/s/${await tokenSeguimiento(otId, tallerId)}`;
}
