import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSesion } from "@/lib/auth";
import { flotaSustitucion, getOT } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { Matricula } from "@/components/ui";
import { FormularioPrestamo } from "../../../sustitucion/formularios";

export const dynamic = "force-dynamic";

export default async function Prestamo({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const { id } = await params;
  const ot = await getOT(s.tid, id);
  if (!ot) notFound();
  const [flota, taller] = await Promise.all([flotaSustitucion(s.tid), tallerPorId(s.tid)]);
  const disponibles = flota.filter((c) => c.estado === "disponible");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <Link href={`/ot/${ot.ot.id}`} className="text-sm text-slate-500">← Orden {ot.ot.numero}</Link>
        <h1 className="text-2xl font-bold mt-1">Préstamo de coche de sustitución</h1>
        <p className="text-slate-600 flex items-center gap-2 flex-wrap">Para <Matricula>{ot.vehiculo.matricula}</Matricula> · {ot.cliente.nombre}</p>
      </div>
      <FormularioPrestamo
        otId={ot.ot.id}
        coches={disponibles.map((c) => ({ id: c.id, matricula: c.matricula, marca: c.marca, modelo: c.modelo, km: c.km, combustible: c.combustible }))}
        conductor={{ nombre: ot.cliente.tipo === "particular" ? ot.cliente.nombre : "", dni: ot.cliente.tipo === "particular" ? ot.cliente.nif ?? "" : "" }}
        pagadorDefecto={ot.ot.datosSiniestro?.cubreSustitucion ? "aseguradora" : "cortesia"}
        edadMin={taller.config.prestamoEdadMinima ?? 25}
        aniosCarnet={taller.config.prestamoAniosCarnet ?? 2}
        puedeForzar={s.rol !== "asesor"}
      />
    </div>
  );
}
