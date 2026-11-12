import { requireSesion } from "@/lib/auth";
import { tallerPorId } from "@/lib/taller";
import { tiposConEstados, listarEmpleados } from "@/lib/data";
import { DIAS_ABIERTOS_BASE, horasTipo } from "@/lib/capacidad";
import { FormCapacidad } from "./formulario";

export const dynamic = "force-dynamic";

export default async function Capacidad() {
  const s = await requireSesion("configuracion");
  const [tl, tipos, empleados] = await Promise.all([tallerPorId(s.tid), tiposConEstados(s.tid), listarEmpleados(s.tid)]);
  const cap = tl.config.capacidad ?? {};
  return (
    <FormCapacidad
      plazas={cap.plazas ?? null}
      maxPorFranja={cap.maxPorFranja ?? null}
      diasAbiertos={cap.diasAbiertos?.length ? cap.diasAbiertos : DIAS_ABIERTOS_BASE}
      tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre, horas: horasTipo(tl.config, t) }))}
      mecanicos={empleados
        .filter((e) => e.activo && e.puestos.includes("mecanico"))
        .map((e) => ({ id: e.id, nombre: e.nombre, color: e.color, especialidades: e.especialidades.length ? e.especialidades : ["mecanica" as const], horasDia: Number(e.horasDia), dias: e.diasTrabajo }))}
    />
  );
}
