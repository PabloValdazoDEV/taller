import { longitudPin } from "@/lib/session-token";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { tallerActual } from "@/lib/taller";
import { NOMBRE_ROL } from "@/lib/auth";
import { PinLogin } from "./pin-login";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const taller = await tallerActual();
  if (!taller) return <p className="p-8">Taller no encontrado.</p>;
  const usuarios = await db
    .select({ id: t.usuarios.id, nombre: t.usuarios.nombre, rol: t.usuarios.rol, color: t.usuarios.color })
    .from(t.usuarios)
    .where(and(eq(t.usuarios.tallerId, taller.id), eq(t.usuarios.activo, true)))
    .orderBy(asc(t.usuarios.rol), asc(t.usuarios.nombre));

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4" style={{ ["--primary" as string]: taller.colorPrimario }}>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-white text-xl font-bold">
            {taller.nombre.replace(/^Taller(es)?\s+/i, "").slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold">{taller.nombre}</h1>
          <p className="text-slate-500">¿Quién eres?</p>
        </div>
        <PinLogin usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre, color: u.color, rolNombre: NOMBRE_ROL[u.rol], cifras: longitudPin(u.rol) }))} />
      </div>
    </main>
  );
}
