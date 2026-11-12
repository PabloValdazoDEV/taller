// PDF del presupuesto para la oficina (con sesión y permiso de importes).
import { getSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { cargarPresupuesto, pdfPresupuesto } from "@/lib/presupuestos";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSesion();
  if (!s || !tiene(s.puestos, "importes")) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const c = await cargarPresupuesto(s.tid, id);
  if (!c) return new Response("No encontrado", { status: 404 });
  return pdfPresupuesto(c);
}
