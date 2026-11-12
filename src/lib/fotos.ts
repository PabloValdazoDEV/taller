import "server-only";
import { db, t } from "@/db";
import { guardarFichero } from "./storage";
import type { Sesion } from "./session-token";

const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 8 * 1024 * 1024;

/** Guarda las fotos recibidas en un FormData y las registra. Devuelve cuántas se guardaron. */
export async function guardarFotos(
  s: Sesion,
  ficheros: FormDataEntryValue[],
  destino: { otId: string | null; entidad: string; entidadId: string },
) {
  let n = 0;
  for (const f of ficheros) {
    if (!(f instanceof File) || f.size === 0) continue;
    const ext = TIPOS[f.type];
    if (!ext || f.size > MAX) continue;
    const buf = Buffer.from(await f.arrayBuffer());
    if (!esImagen(buf, ext)) continue; // el tipo declarado por el navegador no basta: se comprueba la firma del fichero
    const ruta = await guardarFichero(s.tid, "fotos", buf, ext);
    await db.insert(t.archivos).values({
      tallerId: s.tid,
      otId: destino.otId,
      entidad: destino.entidad,
      entidadId: destino.entidadId,
      ruta,
      mime: f.type,
      tamano: f.size,
      subidoPor: s.uid,
    });
    n++;
  }
  return n;
}

/** Comprueba los primeros bytes (JPEG FF D8 FF · PNG 89 50 4E 47 · WEBP «RIFF....WEBP»). */
function esImagen(b: Buffer, ext: string) {
  if (ext === "jpg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === "png") return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (ext === "webp") return b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}
