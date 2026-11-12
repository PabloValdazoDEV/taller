import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { headers } from "next/headers";
import { secreto } from "./session-token";

// Enlaces públicos de descarga de documentos: token firmado (imposible de adivinar) con caducidad.
const DIAS = 30;
const clave = () => new TextEncoder().encode(secreto() + ":documentos");

export async function tokenDocumento(docId: string, tallerId: string) {
  return new SignJWT({ d: docId, t: tallerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(clave());
}

export async function verificarTokenDocumento(token: string): Promise<{ docId: string; tallerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, clave());
    return { docId: String(payload.d), tallerId: String(payload.t) };
  } catch {
    return null;
  }
}

/** URL pública de la app: PUBLIC_URL si está definida; si no, la del propio request. */
export async function urlBase() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  // x-forwarded-host primero: tras un redirect de una Server Action, Next vuelve a pedir la página a sí mismo
  // por su puerto interno (Host: localhost:3000) pero conserva las cabeceras x-forwarded-* de la petición original.
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function enlaceDocumento(docId: string, tallerId: string) {
  return `${await urlBase()}/d/${await tokenDocumento(docId, tallerId)}`;
}

export const DIAS_ENLACE = DIAS;
