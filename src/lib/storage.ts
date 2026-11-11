import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

// Abstracción de almacenamiento: hoy disco local, mañana S3/MinIO sin tocar el resto.
const RAIZ = path.resolve(process.env.STORAGE_DIR ?? "./storage");

function rutaAbsoluta(rel: string) {
  const abs = path.resolve(RAIZ, rel);
  if (!abs.startsWith(RAIZ + path.sep)) throw new Error("Ruta fuera del almacenamiento");
  return abs;
}

export async function guardarFichero(tallerId: string, carpeta: string, datos: Buffer, ext: string) {
  const rel = path.join(tallerId, carpeta, `${randomUUID()}.${ext}`);
  const abs = rutaAbsoluta(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, datos, { flag: "wx" });
  return rel;
}

export async function leerFichero(rel: string) {
  return readFile(rutaAbsoluta(rel));
}

export function sha256(datos: Buffer) {
  return createHash("sha256").update(datos).digest("hex");
}
