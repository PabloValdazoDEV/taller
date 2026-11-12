// Descarga PÚBLICA de un documento firmado mediante enlace con token (enviado al cliente por WhatsApp/email).
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { verificarTokenDocumento } from "@/lib/enlaces";
import { leerFichero, sha256 } from "@/lib/storage";
import { TIPO_DOCUMENTO } from "@/lib/formato";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await verificarTokenDocumento(token);
  if (!v) return new Response("Enlace no válido o caducado. Solicite una copia al taller.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const d = await db.query.documentos.findFirst({ where: and(eq(t.documentos.tallerId, v.tallerId), eq(t.documentos.id, v.docId)) });
  if (!d) return new Response("Documento no encontrado", { status: 404 });
  const pdf = await leerFichero(d.ruta);
  if (sha256(pdf) !== d.sha256) return new Response("El documento no supera la verificación de integridad.", { status: 409 });

  await db.insert(t.auditoria).values({
    tallerId: v.tallerId,
    accion: "descarga_publica",
    entidad: "documento",
    entidadId: d.id,
    ip: req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  const nombre = `${TIPO_DOCUMENTO[d.tipo] ?? "Documento"}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
