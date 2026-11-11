import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Número correlativo por taller y año: "2026-0007". Atómico (UPSERT). */
export async function siguienteNumeroOT(tx: Tx | DB, tallerId: string) {
  const anio = new Date().getFullYear();
  const clave = `ot-${anio}`;
  const res = await tx.execute<{ valor: number }>(sql`
    insert into contadores (taller_id, clave, valor) values (${tallerId}, ${clave}, 1)
    on conflict (taller_id, clave) do update set valor = contadores.valor + 1
    returning valor`);
  const valor = Number(res[0].valor);
  return `${anio}-${String(valor).padStart(4, "0")}`;
}
