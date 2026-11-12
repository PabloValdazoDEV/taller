import { requireSesion } from "@/lib/auth";
import { listarEmpleados } from "@/lib/data";
import { ListaEmpleados } from "./lista";

export const dynamic = "force-dynamic";

export default async function Empleados() {
  const s = await requireSesion("configuracion");
  const empleados = await listarEmpleados(s.tid);
  return <ListaEmpleados empleados={empleados} yoId={s.uid} />;
}
