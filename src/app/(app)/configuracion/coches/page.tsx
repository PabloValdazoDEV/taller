import { requireSesion } from "@/lib/auth";
import { listarCochesConfig } from "@/lib/data";
import { ListaCoches } from "./lista";

export const dynamic = "force-dynamic";

export default async function CochesConfig() {
  const s = await requireSesion("configuracion");
  const coches = await listarCochesConfig(s.tid);
  return <ListaCoches coches={coches} />;
}
