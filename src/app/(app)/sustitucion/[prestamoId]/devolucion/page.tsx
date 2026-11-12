import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { fmtFechaHora } from "@/lib/formato";
import { Matricula } from "@/components/ui";
import { FormularioDevolucion } from "../../formularios";

export const dynamic = "force-dynamic";

export default async function Devolucion({ params }: { params: Promise<{ prestamoId: string }> }) {
  const s = await requireSesion("recepcion");
  const { prestamoId } = await params;
  const [r] = await db
    .select({ p: t.prestamos, coche: t.cochesSustitucion })
    .from(t.prestamos)
    .innerJoin(t.cochesSustitucion, eq(t.cochesSustitucion.id, t.prestamos.cocheId))
    .where(and(eq(t.prestamos.tallerId, s.tid), eq(t.prestamos.id, prestamoId)));
  if (!r) notFound();
  if (r.p.devueltoEn) return <p className="p-6">Este préstamo ya se devolvió el {fmtFechaHora(r.p.devueltoEn)}.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <Link href={r.p.otId ? `/ot/${r.p.otId}` : "/sustitucion"} className="text-sm text-slate-500">← Volver</Link>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-3 flex-wrap">Devolución <Matricula grande>{r.coche.matricula}</Matricula></h1>
        <p className="text-slate-600">{r.coche.marca} {r.coche.modelo} · {r.p.conductorNombre} · prestado {fmtFechaHora(r.p.salidaEn)}</p>
      </div>
      <FormularioDevolucion prestamoId={r.p.id} kmSalida={r.p.kmSalida} combSalida={r.p.combSalida} danosSalida={r.p.danosSalida} conductor={r.p.conductorNombre} />
    </div>
  );
}
