import "server-only";
import { db, t } from "@/db";
import { infoCliente } from "./auth";
import type { Sesion } from "./session-token";

export async function auditar(
  s: Sesion,
  accion: string,
  entidad: string,
  entidadId?: string | null,
  datos?: unknown,
) {
  const { ip, userAgent } = await infoCliente();
  await db.insert(t.auditoria).values({
    tallerId: s.tid,
    usuarioId: s.uid,
    accion,
    entidad,
    entidadId: entidadId ?? null,
    datos: datos ?? null,
    ip,
    userAgent,
  });
}
