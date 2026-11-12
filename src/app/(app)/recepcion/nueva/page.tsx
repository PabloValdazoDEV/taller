import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { compania, tiposConEstados } from "@/lib/data";
import { AsistenteRecepcion, type Prefill } from "./asistente";

export const dynamic = "force-dynamic";

export default async function NuevaRecepcion({ searchParams }: { searchParams: Promise<{ cita?: string; matricula?: string }> }) {
  const s = await requireSesion("recepcion");
  const { cita: citaId, matricula } = await searchParams;
  const [tipos, companias] = await Promise.all([tiposConEstados(s.tid), compania(s.tid)]);

  let prefill: Prefill = matricula ? { matricula, buscar: true } : {};
  if (citaId) {
    const c = await db.query.citas.findFirst({ where: and(eq(t.citas.tallerId, s.tid), eq(t.citas.id, citaId)) });
    if (c) prefill = { citaId: c.id, matricula: c.matricula ?? "", contacto: c.contacto, telefono: c.telefono ?? "", motivo: c.motivo ?? "", tipoOrdenId: c.tipoOrdenId ?? "" };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 max-w-4xl mx-auto">Nueva recepción</h1>
      <AsistenteRecepcion
        tipos={tipos.map((tp) => ({ id: tp.id, nombre: tp.nombre, color: tp.color, requiereSiniestro: tp.requiereSiniestro }))}
        companias={companias}
        prefill={prefill}
      />
    </div>
  );
}
