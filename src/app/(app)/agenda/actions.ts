"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { buscarVehiculo, normalizarMatricula } from "@/lib/data";
import { diaISO, instanteMadrid } from "@/lib/formato";
import { esFranja, franja, franjaDeHora } from "@/lib/citas";
import { limpiarHoras } from "@/lib/capacidad";
import { ESPECIALIDADES } from "@/lib/importes";
import { prevision, type Prevision } from "@/lib/carga";

type R = { error?: string };

/** Al teclear la matrícula: si el coche ya ha venido, propone el cliente y su teléfono. */
export async function datosPorMatricula(matricula: string) {
  const s = await requireSesion("citas");
  if (matricula.replace(/[^a-z0-9]/gi, "").length < 4) return null;
  const r = await buscarVehiculo(s.tid, matricula);
  if (!r) return null;
  return {
    matricula: r.vehiculo.matricula,
    vehiculo: [r.vehiculo.marca, r.vehiculo.modelo].filter(Boolean).join(" ") || null,
    contacto: r.cliente?.nombre ?? null,
    telefono: r.cliente?.telefono ?? null,
  };
}

/** Crea o cambia una cita. Cuándo: día + franja («a primera hora»…) o día + hora exacta. */
export async function guardarCita(fd: FormData): Promise<R & { dia?: string }> {
  const s = await requireSesion("citas");
  const id = String(fd.get("id") ?? "") || null;
  const contacto = String(fd.get("contacto") ?? "").trim();
  const telefono = String(fd.get("telefono") ?? "").trim() || null;
  const matriculaTxt = String(fd.get("matricula") ?? "").trim();
  const dia = String(fd.get("dia") ?? "");
  const fr = String(fd.get("franja") ?? "");
  const hora = String(fd.get("hora") ?? "").trim();
  const motivo = String(fd.get("motivo") ?? "").trim().slice(0, 300) || null;
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 300) || null;
  const tipoOrdenId = String(fd.get("tipoOrdenId") ?? "") || null;
  const horas = leerHoras(fd);
  const necesitaSustitucion = fd.get("necesitaSustitucion") === "on";

  if (contacto.length < 2) return { error: "Indica quién trae el coche" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(dia))) return { error: "Elige el día" };
  if (fr !== "hora" && !esFranja(fr)) return { error: "Elige cuándo: a primera hora, por la mañana… o una hora exacta" };
  if (fr === "hora" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return { error: "Indica la hora (p. ej. 09:30)" };
  if (!id && dia < diaISO()) return { error: "La cita no puede ser en un día pasado" };
  if (tipoOrdenId && !(await db.query.tiposOrden.findFirst({ where: and(eq(t.tiposOrden.tallerId, s.tid), eq(t.tiposOrden.id, tipoOrdenId)) })))
    return { error: "Tipo de trabajo no válido" };

  // Si el coche ya está en el taller (por otra vez que vino), se enlaza con su ficha
  const matricula = matriculaTxt ? normalizarMatricula(matriculaTxt) : null;
  const ficha = matricula ? await buscarVehiculo(s.tid, matricula) : null;
  const valores = {
    contacto: contacto.slice(0, 120),
    telefono,
    matricula,
    clienteId: ficha?.cliente?.id ?? null,
    vehiculoId: ficha?.vehiculo.id ?? null,
    fechaHora: instanteMadrid(dia, fr === "hora" ? hora : franja(fr)!.hora),
    franja: fr === "hora" ? null : (fr as NonNullable<typeof t.citas.$inferInsert.franja>),
    motivo,
    nota,
    tipoOrdenId,
    horas,
    necesitaSustitucion,
  };

  if (id) {
    const r = await db
      .update(t.citas)
      .set(valores)
      .where(and(eq(t.citas.tallerId, s.tid), eq(t.citas.id, id), isNull(t.citas.otId)))
      .returning({ id: t.citas.id });
    if (!r.length) return { error: "Esta cita ya no se puede cambiar (el coche ya se ha recibido)" };
    await auditar(s, "editar_cita", "cita", id, { dia, franja: valores.franja, hora: fr === "hora" ? hora : null, matricula });
  } else {
    const [c] = await db.insert(t.citas).values({ tallerId: s.tid, ...valores, creadoPor: s.uid }).returning({ id: t.citas.id });
    await auditar(s, "crear_cita", "cita", c.id, { dia, franja: valores.franja, hora: fr === "hora" ? hora : null, matricula, contacto });
  }
  revalidatePath("/", "layout");
  return { dia };
}

const leerHoras = (fd: FormData) =>
  limpiarHoras(Object.fromEntries(ESPECIALIDADES.map((e) => [e, String(fd.get(`horas_${e}`) ?? "").replace(",", ".")])));

/** Mientras se da la cita: cómo va ese día con ella y, si no cabe, el primer día con hueco. Solo informa. */
export async function previsionCita(fd: FormData): Promise<Prevision | null> {
  const s = await requireSesion("citas");
  const dia = String(fd.get("dia") ?? "");
  const fr = String(fd.get("franja") ?? "");
  const hora = String(fd.get("hora") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(dia))) return null;
  const f = esFranja(fr) ? fr : fr === "hora" && /^\d{2}:\d{2}$/.test(hora) ? franjaDeHora(hora) : null;
  if (!f) return null;
  const tipoOrdenId = String(fd.get("tipoOrdenId") ?? "") || null;
  return prevision(
    s.tid,
    { dia, franja: f, horas: leerHoras(fd), tipoOrdenId, sust: fd.get("necesitaSustitucion") === "on" },
    String(fd.get("id") ?? "") || null,
  );
}

/** Anular, marcar que no vino o volver a dejarla pendiente. */
export async function cambiarEstadoCita(id: string, estado: "pendiente" | "anulada" | "no_vino"): Promise<R> {
  const s = await requireSesion("citas");
  if (!["pendiente", "anulada", "no_vino"].includes(estado)) return { error: "Estado no válido" };
  const r = await db
    .update(t.citas)
    .set({ estado })
    .where(and(eq(t.citas.tallerId, s.tid), eq(t.citas.id, id), isNull(t.citas.otId)))
    .returning({ id: t.citas.id });
  if (!r.length) return { error: "Cita no encontrada o ya recibida" };
  await auditar(s, `cita_${estado}`, "cita", id, {});
  revalidatePath("/", "layout");
  return {};
}
