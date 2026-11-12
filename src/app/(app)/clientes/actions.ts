"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

const vacio = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? null : String(v).trim());

const Esquema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio"),
  email: z.string().email("Email no válido").nullable(),
});

export async function actualizarCliente(fd: FormData): Promise<{ error?: string }> {
  const s = await requireSesion(["admin", "asesor", "jefe_taller"]);
  const id = String(fd.get("id"));
  const datos = {
    tipo: String(fd.get("tipo")) as (typeof t.tipoClienteEnum.enumValues)[number],
    nombre: String(fd.get("nombre") ?? "").trim(),
    nif: vacio(fd.get("nif"))?.toUpperCase() ?? null,
    telefono: vacio(fd.get("telefono")),
    email: vacio(fd.get("email")),
    direccion: vacio(fd.get("direccion")),
    notas: vacio(fd.get("notas")),
    aceptaLlamada: fd.get("aceptaLlamada") === "on",
    aceptaWhatsapp: fd.get("aceptaWhatsapp") === "on",
    aceptaEmail: fd.get("aceptaEmail") === "on",
    exentoIva: fd.get("exentoIva") === "on",
    motivoExencion: vacio(fd.get("motivoExencion")),
  };
  const v = Esquema.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0].message };
  if (!t.tipoClienteEnum.enumValues.includes(datos.tipo)) return { error: "Tipo no válido" };
  if (datos.exentoIva && !datos.motivoExencion) return { error: "Indica el motivo de la exención de IVA" };

  const r = await db.update(t.clientes).set(datos).where(and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, id))).returning({ id: t.clientes.id });
  if (!r.length) return { error: "Cliente no encontrado" };
  await auditar(s, "editar_cliente", "cliente", id);
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return {};
}
