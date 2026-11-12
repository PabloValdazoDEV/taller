"use server";

import { and, eq, inArray, or, sql } from "drizzle-orm";
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
  const s = await requireSesion("clientes");
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

/**
 * Alta de una compañía: aseguradora, renting/flota o empresa (los particulares se dan de alta al recibir su coche).
 * Devuelve id y nombre para seleccionarla al momento (p. ej. desde la recepción).
 */
export async function crearCompania(fd: FormData): Promise<{ error?: string; id?: string; nombre?: string; tipo?: string }> {
  const s = await requireSesion("clientes");
  const tipo = String(fd.get("tipo") ?? "");
  if (!["aseguradora", "flota", "empresa"].includes(tipo)) return { error: "Elige el tipo" };
  const datos = {
    tipo: tipo as "aseguradora" | "flota" | "empresa",
    nombre: String(fd.get("nombre") ?? "").trim().slice(0, 120),
    nif: vacio(fd.get("nif"))?.toUpperCase().replace(/[\s-]/g, "") ?? null,
    telefono: vacio(fd.get("telefono")),
    email: vacio(fd.get("email")),
    direccion: vacio(fd.get("direccion")),
    notas: vacio(fd.get("notas"))?.slice(0, 1000) ?? null,
  };
  const v = Esquema.safeParse(datos);
  if (!v.success) return { error: v.error.issues[0].message };

  // Sin duplicados: mismo nombre o mismo NIF entre las compañías del taller
  const repetida = await db.query.clientes.findFirst({
    where: and(
      eq(t.clientes.tallerId, s.tid),
      inArray(t.clientes.tipo, ["aseguradora", "flota", "empresa"]),
      or(sql`lower(${t.clientes.nombre}) = lower(${datos.nombre})`, datos.nif ? eq(t.clientes.nif, datos.nif) : undefined),
    ),
  });
  if (repetida) return { error: `Ya existe «${repetida.nombre}»${repetida.nif ? ` (NIF ${repetida.nif})` : ""}` };

  const [c] = await db
    .insert(t.clientes)
    .values({ tallerId: s.tid, ...datos, aceptaLlamada: true, aceptaWhatsapp: false, aceptaEmail: !!datos.email })
    .returning({ id: t.clientes.id, nombre: t.clientes.nombre, tipo: t.clientes.tipo });
  await auditar(s, "crear_compania", "cliente", c.id, { nombre: c.nombre, tipo: c.tipo });
  revalidatePath("/clientes");
  return { id: c.id, nombre: c.nombre, tipo: c.tipo };
}
