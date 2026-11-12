import { requireSesion } from "@/lib/auth";
import { Pestanas } from "./pestanas";

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  await requireSesion("configuracion");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-slate-500">Empleados, coches de sustitución y datos del taller.</p>
      </div>
      <Pestanas />
      {children}
    </div>
  );
}
