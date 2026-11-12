import { getSesion } from "@/lib/auth";
import { buscarGlobal } from "@/lib/data";
import { tiene } from "@/lib/puestos";

/** Sugerencias del buscador predictivo (desde 2 caracteres). Solo oficina; siempre filtrado por taller. */
export async function GET(req: Request) {
  const s = await getSesion();
  if (!s) return Response.json({ error: "Sin sesión" }, { status: 401 });
  if (!tiene(s.puestos, "oficina")) return Response.json({ error: "Sin permiso" }, { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ ordenes: [], clientes: [] });

  const { ordenes, clientes } = await buscarGlobal(s.tid, q);
  return Response.json(
    {
      ordenes: ordenes.slice(0, 6).map((o) => ({
        id: o.id,
        numero: o.numero,
        matricula: o.matricula,
        marca: o.marca,
        modelo: o.modelo,
        cliente: o.clienteNombre,
        estado: o.cerradaEn ? "Entregado" : o.estadoNombre,
        color: o.cerradaEn ? "#94a3b8" : o.tipoColor,
        abierta: !o.cerradaEn,
      })),
      clientes: clientes.slice(0, 4).map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono, matriculas: c.matriculas.slice(0, 3) })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
