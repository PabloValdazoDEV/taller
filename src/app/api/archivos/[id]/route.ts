import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getSesion } from "@/lib/auth";
import { leerFichero } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSesion();
  if (!s) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const a = await db.query.archivos.findFirst({ where: and(eq(t.archivos.tallerId, s.tid), eq(t.archivos.id, id)) });
  if (!a) return new Response("No encontrado", { status: 404 });
  const datos = await leerFichero(a.ruta);
  return new Response(new Uint8Array(datos), {
    headers: { "Content-Type": a.mime, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
