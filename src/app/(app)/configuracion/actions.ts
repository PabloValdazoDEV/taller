"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { esPuesto, type Puesto } from "@/lib/puestos";
import { normalizarMatricula } from "@/lib/data";
import { DanosZ } from "@/lib/danos";
import type { Dano } from "@/db/schema";
import { guardarFichero } from "@/lib/storage";
import { tallerPorId } from "@/lib/taller";
import { TEXTOS_LEGALES_BASE } from "@/lib/flujos-base";

type R = { error?: string };
const vacio = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? null : String(v).trim());

// ───────────────────────── Empleados ─────────────────────────

const EmpleadoZ = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio").max(40, "Nombre demasiado largo"),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Color no válido"),
  puestos: z.array(z.string()).min(1, "Marca al menos un puesto"),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 cifras").nullable(),
});

/** ¿Quedaría el taller sin nadie de dirección activo si a `exceptoId` le quitamos dirección o lo damos de baja? */
async function quedaSinDireccion(tid: string, exceptoId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(t.usuarios)
    .where(and(eq(t.usuarios.tallerId, tid), eq(t.usuarios.activo, true), ne(t.usuarios.id, exceptoId), sql`${"direccion"} = any(${t.usuarios.puestos})`));
  return r.n === 0;
}

export async function guardarEmpleado(fd: FormData): Promise<R> {
  const s = await requireSesion("configuracion");
  const id = vacio(fd.get("id"));
  const v = EmpleadoZ.safeParse({
    nombre: String(fd.get("nombre") ?? ""),
    color: String(fd.get("color") ?? ""),
    puestos: fd.getAll("puestos").map(String),
    pin: vacio(fd.get("pin")),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const puestos = v.data.puestos.filter(esPuesto) as Puesto[];
  if (!puestos.length) return { error: "Marca al menos un puesto" };

  // Nombre único entre los activos (en la pantalla de acceso se elige por nombre)
  const repetido = await db.query.usuarios.findFirst({
    where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.activo, true), sql`lower(${t.usuarios.nombre}) = lower(${v.data.nombre})`, id ? ne(t.usuarios.id, id) : undefined),
  });
  if (repetido) return { error: `Ya hay un empleado activo llamado «${repetido.nombre}»` };

  if (!id) {
    if (!v.data.pin) return { error: "Indica un PIN de 4 cifras" };
    const [u] = await db
      .insert(t.usuarios)
      .values({ tallerId: s.tid, nombre: v.data.nombre, color: v.data.color, puestos, pinHash: await bcrypt.hash(v.data.pin, 10) })
      .returning({ id: t.usuarios.id });
    await auditar(s, "crear_empleado", "usuario", u.id, { nombre: v.data.nombre, puestos });
  } else {
    const actual = await db.query.usuarios.findFirst({ where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, id)) });
    if (!actual) return { error: "Empleado no encontrado" };
    if (actual.puestos.includes("direccion") && !puestos.includes("direccion") && actual.activo && (await quedaSinDireccion(s.tid, id)))
      return { error: "Tiene que quedar al menos una persona con el puesto de Dirección" };
    await db
      .update(t.usuarios)
      .set({ nombre: v.data.nombre, color: v.data.color, puestos, ...(v.data.pin ? { pinHash: await bcrypt.hash(v.data.pin, 10) } : {}) })
      .where(and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, id)));
    await auditar(s, "editar_empleado", "usuario", id, { nombre: v.data.nombre, puestos, cambioPin: !!v.data.pin });
  }
  revalidatePath("/configuracion/empleados");
  return {};
}

/** Baja / reactivación. No se borra nunca: sus firmas, estados y auditoría siguen apuntando a él. */
export async function cambiarActivoEmpleado(id: string, activo: boolean): Promise<R> {
  const s = await requireSesion("configuracion");
  if (!activo && id === s.uid) return { error: "No puedes darte de baja a ti mismo" };
  const u = await db.query.usuarios.findFirst({ where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, id)) });
  if (!u) return { error: "Empleado no encontrado" };
  if (!activo && u.puestos.includes("direccion") && (await quedaSinDireccion(s.tid, id)))
    return { error: "Tiene que quedar al menos una persona con el puesto de Dirección" };
  if (activo) {
    const repetido = await db.query.usuarios.findFirst({
      where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.activo, true), sql`lower(${t.usuarios.nombre}) = lower(${u.nombre})`),
    });
    if (repetido) return { error: `Ya hay un empleado activo llamado «${repetido.nombre}». Cambia el nombre de uno de los dos.` };
  }
  if (!activo) {
    // Sus trabajos abiertos quedan sin asignar para que el jefe de taller los reparta
    await db
      .update(t.ordenesTrabajo)
      .set({ mecanicoId: null })
      .where(and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.mecanicoId, id), sql`${t.ordenesTrabajo.cerradaEn} is null`));
  }
  await db.update(t.usuarios).set({ activo }).where(and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, id)));
  await auditar(s, activo ? "reactivar_empleado" : "baja_empleado", "usuario", id);
  revalidatePath("/configuracion/empleados");
  return {};
}

// ───────────────────────── Coches de sustitución ─────────────────────────

const fechaOpc = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").nullable();
const CocheZ = z.object({
  matricula: z.string().min(4, "Matrícula no válida").max(12, "Matrícula no válida"),
  marca: z.string().trim().min(1, "Indica la marca"),
  modelo: z.string().trim().min(1, "Indica el modelo"),
  km: z.coerce.number({ invalid_type_error: "Km no válidos" }).int().min(0, "Km no válidos").max(2_000_000, "Km no válidos"),
  combustible: z.coerce.number().int().min(0).max(8),
  itvHasta: fechaOpc,
  seguroHasta: fechaOpc,
  notas: z.string().nullable(),
  enMantenimiento: z.boolean(),
  danos: DanosZ,
});

export async function guardarCoche(fd: FormData): Promise<R> {
  const s = await requireSesion("configuracion");
  const id = vacio(fd.get("id"));
  const v = CocheZ.safeParse({
    matricula: normalizarMatricula(String(fd.get("matricula") ?? "")),
    marca: String(fd.get("marca") ?? ""),
    modelo: String(fd.get("modelo") ?? ""),
    km: fd.get("km") || 0,
    combustible: fd.get("combustible") || 8,
    itvHasta: vacio(fd.get("itvHasta")),
    seguroHasta: vacio(fd.get("seguroHasta")),
    notas: vacio(fd.get("notas")),
    enMantenimiento: fd.get("enMantenimiento") === "on",
    danos: JSON.parse(String(fd.get("danos") ?? "[]")),
  });
  if (!v.success) return { error: v.error.issues[0].message };
  const d = v.data;
  const danos = d.danos as Dano[];

  const repetido = await db.query.cochesSustitucion.findFirst({
    where: and(
      eq(t.cochesSustitucion.tallerId, s.tid),
      eq(t.cochesSustitucion.activo, true),
      sql`replace(upper(${t.cochesSustitucion.matricula}), ' ', '') = ${d.matricula.replace(/ /g, "")}`,
      id ? ne(t.cochesSustitucion.id, id) : undefined,
    ),
  });
  if (repetido) return { error: `Ya existe un coche de sustitución con la matrícula ${repetido.matricula}` };

  const datos = { matricula: d.matricula, marca: d.marca, modelo: d.modelo, itvHasta: d.itvHasta, seguroHasta: d.seguroHasta, notas: d.notas };
  if (!id) {
    const [c] = await db
      .insert(t.cochesSustitucion)
      .values({ tallerId: s.tid, ...datos, danos, km: d.km, combustible: d.combustible, estado: d.enMantenimiento ? "mantenimiento" : "disponible" })
      .returning({ id: t.cochesSustitucion.id });
    await auditar(s, "crear_coche_sustitucion", "coche_sustitucion", c.id, datos);
  } else {
    const actual = await db.query.cochesSustitucion.findFirst({ where: and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)) });
    if (!actual) return { error: "Coche no encontrado" };
    const prestado = actual.estado === "prestado";
    if (prestado && d.enMantenimiento) return { error: "El coche está prestado: registra antes la devolución" };
    await db
      .update(t.cochesSustitucion)
      .set({
        ...datos,
        // Mientras está prestado, km, combustible y daños los fija la devolución firmada
        ...(prestado ? {} : { danos, km: d.km, combustible: d.combustible, estado: d.enMantenimiento ? ("mantenimiento" as const) : ("disponible" as const) }),
      })
      .where(and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)));
    await auditar(s, "editar_coche_sustitucion", "coche_sustitucion", id, { ...datos, danosAntes: actual.danos.length, danosAhora: prestado ? actual.danos.length : danos.length });
  }
  revalidatePath("/configuracion/coches");
  revalidatePath("/sustitucion");
  return {};
}

/**
 * Eliminar un coche: si nunca se ha prestado se borra del todo; si tiene préstamos (con documentos firmados)
 * se da de baja y se conserva su historial.
 */
export async function eliminarCoche(id: string): Promise<R & { baja?: boolean }> {
  const s = await requireSesion("configuracion");
  const c = await db.query.cochesSustitucion.findFirst({ where: and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)) });
  if (!c) return { error: "Coche no encontrado" };
  if (c.estado === "prestado") return { error: "El coche está prestado: registra antes la devolución" };
  const [p] = await db.select({ n: count() }).from(t.prestamos).where(and(eq(t.prestamos.tallerId, s.tid), eq(t.prestamos.cocheId, id)));
  if (p.n === 0) {
    await db.delete(t.cochesSustitucion).where(and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)));
    await auditar(s, "eliminar_coche_sustitucion", "coche_sustitucion", id, { matricula: c.matricula });
  } else {
    await db.update(t.cochesSustitucion).set({ activo: false }).where(and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)));
    await auditar(s, "baja_coche_sustitucion", "coche_sustitucion", id, { matricula: c.matricula });
  }
  revalidatePath("/configuracion/coches");
  revalidatePath("/sustitucion");
  return { baja: p.n > 0 };
}

export async function reactivarCoche(id: string): Promise<R> {
  const s = await requireSesion("configuracion");
  const c = await db.query.cochesSustitucion.findFirst({ where: and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)) });
  if (!c) return { error: "Coche no encontrado" };
  const repetido = await db.query.cochesSustitucion.findFirst({
    where: and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.activo, true), eq(t.cochesSustitucion.matricula, c.matricula)),
  });
  if (repetido) return { error: `Ya hay otro coche activo con la matrícula ${c.matricula}` };
  await db.update(t.cochesSustitucion).set({ activo: true, estado: "disponible" }).where(and(eq(t.cochesSustitucion.tallerId, s.tid), eq(t.cochesSustitucion.id, id)));
  await auditar(s, "reactivar_coche_sustitucion", "coche_sustitucion", id);
  revalidatePath("/configuracion/coches");
  revalidatePath("/sustitucion");
  return {};
}

// ───────────────────────── Datos del taller ─────────────────────────

const TallerZ = z.object({
  nombre: z.string().trim().min(2, "El nombre comercial es obligatorio"),
  razonSocial: z.string().nullable(),
  nif: z.string().nullable(),
  direccion: z.string().nullable(),
  telefono: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().email("Email no válido").nullable(),
  horario: z.string().nullable(),
  prestamoEdadMinima: z.coerce.number().int().min(18, "Edad mínima no válida").max(99, "Edad mínima no válida"),
  prestamoAniosCarnet: z.coerce.number().int().min(0, "Años de carnet no válidos").max(50, "Años de carnet no válidos"),
  textoResguardo: z.string().nullable(),
  textoEntrega: z.string().nullable(),
  garantiaTexto: z.string().nullable(),
  textoPrestamo: z.string().nullable(),
});

const TIPOS_LOGO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function guardarTaller(fd: FormData): Promise<R> {
  const s = await requireSesion("configuracion");
  const v = TallerZ.safeParse(Object.fromEntries([...TallerZ.keyof().options].map((k) => [k, vacio(fd.get(k))])));
  if (!v.success) return { error: v.error.issues[0].message };
  const d = v.data;
  const actual = await tallerPorId(s.tid);

  let logoRuta = actual.logoRuta;
  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = TIPOS_LOGO[logo.type];
    if (!ext) return { error: "El logo debe ser PNG, JPG o WEBP" };
    if (logo.size > 2 * 1024 * 1024) return { error: "El logo no puede pasar de 2 MB" };
    logoRuta = await guardarFichero(s.tid, "logo", Buffer.from(await logo.arrayBuffer()), ext);
  }
  if (fd.get("quitarLogo") === "on") logoRuta = null;

  // Sello: solo PNG/JPEG porque se incrusta en los PDF (react-pdf no admite WEBP)
  let selloRuta = actual.selloRuta;
  const sello = fd.get("sello");
  if (sello instanceof File && sello.size > 0) {
    const ext = sello.type === "image/png" ? "png" : sello.type === "image/jpeg" ? "jpg" : null;
    if (!ext) return { error: "El sello debe ser PNG o JPG" };
    if (sello.size > 1024 * 1024) return { error: "El sello no puede pasar de 1 MB" };
    selloRuta = await guardarFichero(s.tid, "sello", Buffer.from(await sello.arrayBuffer()), ext);
  }
  if (fd.get("quitarSello") === "on") selloRuta = null;

  await db
    .update(t.talleres)
    .set({
      nombre: d.nombre,
      razonSocial: d.razonSocial,
      nif: d.nif?.toUpperCase() ?? null,
      direccion: d.direccion,
      telefono: d.telefono,
      whatsapp: d.whatsapp,
      email: d.email,
      logoRuta,
      selloRuta,
      config: {
        ...actual.config,
        horario: d.horario ?? undefined,
        prestamoEdadMinima: d.prestamoEdadMinima,
        prestamoAniosCarnet: d.prestamoAniosCarnet,
        textoResguardo: d.textoResguardo ?? TEXTOS_LEGALES_BASE.textoResguardo,
        textoEntrega: d.textoEntrega ?? TEXTOS_LEGALES_BASE.textoEntrega,
        garantiaTexto: d.garantiaTexto ?? TEXTOS_LEGALES_BASE.garantiaTexto,
        textoPrestamo: d.textoPrestamo ?? TEXTOS_LEGALES_BASE.textoPrestamo,
      },
    })
    .where(eq(t.talleres.id, s.tid));
  await auditar(s, "editar_taller", "taller", s.tid, { nombre: d.nombre, logoCambiado: logoRuta !== actual.logoRuta, selloCambiado: selloRuta !== actual.selloRuta });
  revalidatePath("/", "layout");
  return {};
}
