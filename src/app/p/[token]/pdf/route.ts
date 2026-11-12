// PDF del presupuesto para el cliente (enlace firmado, sin sesión).
import { cargarPresupuesto, pdfPresupuesto, verificarTokenPresupuesto } from "@/lib/presupuestos";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const v = await verificarTokenPresupuesto((await params).token);
  if (!v) return new Response("Enlace no válido o caducado. Pida al taller un presupuesto actualizado.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const c = await cargarPresupuesto(v.tallerId, v.id);
  if (!c || c.p.estado === "borrado") return new Response("Presupuesto no disponible", { status: 404 });
  return pdfPresupuesto(c);
}
