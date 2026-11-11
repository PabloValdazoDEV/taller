import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getSesion } from "@/lib/auth";
import { leerFichero, sha256 } from "@/lib/storage";
import { TIPO_DOCUMENTO } from "@/lib/formato";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSesion();
  if (!s) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const d = await db.query.documentos.findFirst({ where: and(eq(t.documentos.tallerId, s.tid), eq(t.documentos.id, id)) });
  if (!d) return new Response("No encontrado", { status: 404 });
  const pdf = await leerFichero(d.ruta);
  // Integridad: si el fichero se hubiera alterado, el hash no coincide
  const integro = sha256(pdf) === d.sha256;
  if (!integro) return new Response("El documento no supera la verificación de integridad (SHA-256).", { status: 409 });
  const nombre = `${TIPO_DOCUMENTO[d.tipo] ?? d.tipo} ${d.id.slice(0, 8)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
      "X-Documento-SHA256": d.sha256,
    },
  });
}
