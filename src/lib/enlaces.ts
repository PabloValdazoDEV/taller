import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { headers } from "next/headers";

// Enlaces públicos de descarga de documentos: token firmado (imposible de adivinar) con caducidad.
const DIAS = 30;
const clave = () => new TextEncoder().encode(process.env.SESSION_SECRET! + ":documentos");

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
  const proto = h.get("x-forwarded-proto") ?? (h.get("host")?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${h.get("host")}`;
}

export async function enlaceDocumento(docId: string, tallerId: string) {
  return `${await urlBase()}/d/${await tokenDocumento(docId, tallerId)}`;
}

export const DIAS_ENLACE = DIAS;
