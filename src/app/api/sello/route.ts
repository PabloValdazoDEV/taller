// Sello o firma del taller: solo para la vista previa en Configuración (requiere sesión con ese permiso).
import { requireSesion } from "@/lib/auth";
import { tallerPorId } from "@/lib/taller";
import { leerFichero } from "@/lib/storage";

export async function GET() {
  const s = await requireSesion("configuracion");
  const taller = await tallerPorId(s.tid);
  if (!taller.selloRuta) return new Response("Sin sello", { status: 404 });
  const tipo = taller.selloRuta.endsWith(".png") ? "image/png" : "image/jpeg";
  const datos = await leerFichero(taller.selloRuta).catch(() => null);
  if (!datos) return new Response("Sin sello", { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: { "Content-Type": tipo, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
