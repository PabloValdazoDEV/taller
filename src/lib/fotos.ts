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
