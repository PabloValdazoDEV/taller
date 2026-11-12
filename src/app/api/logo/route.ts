// Logo del taller (público: se muestra en la pantalla de acceso, antes de iniciar sesión).
import { tallerActual } from "@/lib/taller";
import { leerFichero } from "@/lib/storage";

export async function GET() {
  const taller = await tallerActual();
  if (!taller?.logoRuta) return new Response("Sin logo", { status: 404 });
  const ext = taller.logoRuta.split(".").pop()?.toLowerCase();
  const tipo = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const datos = await leerFichero(taller.logoRuta).catch(() => null);
  if (!datos) return new Response("Sin logo", { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
