"use server";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { tiene } from "@/lib/puestos";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { guardarFotos } from "@/lib/fotos";

type R = { error?: string };

async function cargarOT(tid: string, otId: string) {
  const ot = await db.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, tid), eq(t.ordenesTrabajo.id, otId)) });
  if (!ot) return null;
  const estados = await db.select().from(t.estadosFlujo).where(and(eq(t.estadosFlujo.tallerId, tid), eq(t.estadosFlujo.tipoOrdenId, ot.tipoOrdenId))).orderBy(asc(t.estadosFlujo.orden));
  return { ot, estados };
}

function refrescar(otId: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/ot/${otId}`);
}

const MINUTOS_DESHACER = 10;

/**
 * Cambia el estado de la orden. estadoId null = avanzar al siguiente.
 * Reglas (en servidor, no solo en pantalla):
 *  - el mecánico solo mueve SUS trabajos y solo al estado siguiente;
 *  - salir hacia delante de un estado «requiere aprobación» es cosa de oficina y exige indicar cómo se aprobó;
 *  - el estado final solo se alcanza con la entrega firmada.
 */
export async function cambiarEstado(otId: string, estadoId: string | null, comentario?: string, nuevoMecanicoId?: string | null): Promise<R> {
  const s = await requireSesion();
  const c = await cargarOT(s.tid, otId);
  if (!c) return { error: "Orden no encontrada" };
  const { ot, estados } = c;
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  if (!tiene(s.puestos, "gestionTaller") && ot.mecanicoId !== s.uid) return { error: "Solo puedes mover tus propios trabajos" };

  const actual = estados.find((e) => e.id === ot.estadoId);
  if (!actual) return { error: "El estado actual de la orden no pertenece a su flujo. Revisa la configuración." };
  const siguiente = estados.find((e) => e.orden > actual.orden);
  const destino = estadoId ? estados.find((e) => e.id === estadoId) : siguiente;
  if (!destino) return { error: "No hay estado siguiente" };
  if (destino.id === actual.id) return {};
  if (destino.marca === "final") return { error: "Para entregar el vehículo usa «Entregar» (requiere firma)" };
  const avanza = destino.orden > actual.orden;
  const nota = comentario?.trim() || null;

  if (!tiene(s.puestos, "gestionTaller")) {
    if (!avanza) return { error: "Pide al jefe de taller que retroceda el estado" };
    if (destino.id !== siguiente?.id) return { error: "Solo puedes pasar al estado siguiente" };
  }
  if (avanza && actual.requiereAprobacion) {
    if (!tiene(s.puestos, "gestionTaller")) return { error: "Pendiente de aprobación del cliente: lo debe confirmar la oficina" };
    if (!nota) return { error: "Indica cómo aprobó el cliente (p. ej. «Aprobado por teléfono, 450 €»)" };
  }

  // Traspaso: quién hace la fase siguiente (undefined = no cambia)
  const cambiaMecanico = nuevoMecanicoId !== undefined && nuevoMecanicoId !== ot.mecanicoId;
  let nombreMecanico: string | null = null;
  if (cambiaMecanico && nuevoMecanicoId) {
    const m = await db.query.usuarios.findFirst({
      where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, nuevoMecanicoId), eq(t.usuarios.activo, true), sql`${t.usuarios.puestos} && array['mecanico','jefe_taller']::text[]`),
    });
    if (!m) return { error: "Mecánico no válido" };
    nombreMecanico = m.nombre;
  }

  const ok = await db.transaction(async (tx) => {
    // Solo si sigue abierta y en el mismo estado (evita carreras con la entrega u otro usuario)
    const r = await tx
      .update(t.ordenesTrabajo)
      .set({ estadoId: destino.id, actualizadaEn: new Date(), ...(cambiaMecanico ? { mecanicoId: nuevoMecanicoId } : {}) })
      .where(and(eq(t.ordenesTrabajo.id, ot.id), isNull(t.ordenesTrabajo.cerradaEn), eq(t.ordenesTrabajo.estadoId, actual.id)))
      .returning({ id: t.ordenesTrabajo.id });
    if (!r.length) return false;
    await tx.insert(t.historialEstados).values({ tallerId: s.tid, otId: ot.id, estadoId: destino.id, usuarioId: s.uid, comentario: nota });
    return true;
  });
  if (!ok) return { error: "La orden ha cambiado mientras tanto. Recarga la página." };
  // mecanicoAntes permite que «Deshacer» devuelva también el trabajo a quien lo tenía
  await auditar(s, "cambiar_estado", "ot", ot.id, { de: actual.nombre, a: destino.nombre, comentario: nota, ...(cambiaMecanico ? { mecanicoAntes: ot.mecanicoId } : {}) });
  if (cambiaMecanico) await auditar(s, "asignar_mecanico", "ot", ot.id, { mecanicoId: nuevoMecanicoId, nombre: nombreMecanico });
  refrescar(ot.id);
  return {};
}

/** Deshace el último cambio de estado si lo hizo el mismo usuario hace menos de 10 minutos. */
export async function deshacerCambioEstado(otId: string): Promise<R> {
  const s = await requireSesion();
  const c = await cargarOT(s.tid, otId);
  if (!c) return { error: "Orden no encontrada" };
  const { ot } = c;
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  const [ultimo, anterior] = await db
    .select()
    .from(t.historialEstados)
    .where(and(eq(t.historialEstados.tallerId, s.tid), eq(t.historialEstados.otId, ot.id)))
    .orderBy(desc(t.historialEstados.fecha))
    .limit(2);
  if (!ultimo || !anterior || ultimo.estadoId !== ot.estadoId) return { error: "No hay ningún cambio que deshacer" };
  if (ultimo.usuarioId !== s.uid) return { error: "Solo puedes deshacer tus propios cambios" };
  if (Date.now() - ultimo.fecha.getTime() > MINUTOS_DESHACER * 60_000) return { error: `Solo se puede deshacer durante ${MINUTOS_DESHACER} minutos` };

  const ok = await db.transaction(async (tx) => {
    const r = await tx
      .update(t.ordenesTrabajo)
      .set({ estadoId: anterior.estadoId, actualizadaEn: new Date() })
      .where(and(eq(t.ordenesTrabajo.id, ot.id), isNull(t.ordenesTrabajo.cerradaEn), eq(t.ordenesTrabajo.estadoId, ultimo.estadoId)))
      .returning({ id: t.ordenesTrabajo.id });
    if (!r.length) return false;
    await tx.insert(t.historialEstados).values({ tallerId: s.tid, otId: ot.id, estadoId: anterior.estadoId, usuarioId: s.uid, comentario: "Cambio deshecho" });
    return true;
  });
  if (!ok) return { error: "La orden ha cambiado mientras tanto. Recarga la página." };
  // Si al avanzar se traspasó el trabajo, vuelve a quien lo tenía
  const [ultimoCambio] = await db
    .select({ datos: t.auditoria.datos })
    .from(t.auditoria)
    .where(and(eq(t.auditoria.tallerId, s.tid), eq(t.auditoria.entidadId, ot.id), eq(t.auditoria.accion, "cambiar_estado"), eq(t.auditoria.usuarioId, s.uid)))
    .orderBy(desc(t.auditoria.fecha))
    .limit(1);
  const datos = ultimoCambio?.datos as { mecanicoAntes?: string | null } | undefined;
  if (datos && "mecanicoAntes" in datos) {
    await db.update(t.ordenesTrabajo).set({ mecanicoId: datos.mecanicoAntes ?? null }).where(eq(t.ordenesTrabajo.id, ot.id));
    const previo = datos.mecanicoAntes ? await db.query.usuarios.findFirst({ where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, datos.mecanicoAntes)) }) : null;
    await auditar(s, "asignar_mecanico", "ot", ot.id, { mecanicoId: datos.mecanicoAntes ?? null, nombre: previo?.nombre ?? null, deshecho: true });
  }
  await auditar(s, "deshacer_estado", "ot", ot.id);
  refrescar(ot.id);
  return {};
}

export async function asignarMecanico(otId: string, mecanicoId: string | null): Promise<R> {
  const s = await requireSesion("gestionTaller");
  const c = await cargarOT(s.tid, otId);
  if (!c) return { error: "Orden no encontrada" };
  const { ot } = c;
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  let nombre: string | null = null;
  if (mecanicoId) {
    const m = await db.query.usuarios.findFirst({
      where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, mecanicoId), eq(t.usuarios.activo, true), sql`${t.usuarios.puestos} && array['mecanico','jefe_taller']::text[]`),
    });
    if (!m) return { error: "Mecánico no válido" };
    nombre = m.nombre;
  }
  await db.update(t.ordenesTrabajo).set({ mecanicoId, actualizadaEn: new Date() }).where(eq(t.ordenesTrabajo.id, ot.id));
  await auditar(s, "asignar_mecanico", "ot", ot.id, { mecanicoId, nombre });
  refrescar(ot.id);
  return {};
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function crearIncidencia(fd: FormData): Promise<R> {
  const s = await requireSesion();
  const c = await cargarOT(s.tid, String(fd.get("otId")));
  if (!c) return { error: "Orden no encontrada" };
  const { ot } = c;
  if (ot.cerradaEn && !tiene(s.puestos, "oficina")) return { error: "La orden ya está cerrada" };
  const tipo = String(fd.get("tipo")) as (typeof t.tipoIncidenciaEnum.enumValues)[number];
  if (!t.tipoIncidenciaEnum.enumValues.includes(tipo)) return { error: "Tipo no válido" };
  const descripcion = String(fd.get("descripcion") ?? "").trim();
  if (descripcion.length < 3) return { error: "Describe la incidencia" };
  // La fecha prevista que ve el cliente la cambia la oficina
  const nuevaFecha = !tiene(s.puestos, "oficina") ? null : String(fd.get("nuevaFecha") ?? "") || null;
  if (nuevaFecha && (!FECHA.test(nuevaFecha) || isNaN(Date.parse(nuevaFecha)))) return { error: "Fecha no válida" };

  const [inc] = await db
    .insert(t.incidencias)
    .values({
      tallerId: s.tid,
      otId: ot.id,
      tipo,
      descripcion,
      visibleCliente: tipo !== "dano_taller",
      afectaPrecio: tipo === "averia_adicional" || fd.get("afectaPrecio") === "on",
      afectaPlazo: tipo === "retraso_piezas" || !!nuevaFecha,
      nuevaFecha,
      creadaPor: s.uid,
    })
    .returning();
  if (nuevaFecha) await db.update(t.ordenesTrabajo).set({ fechaPrevista: nuevaFecha, actualizadaEn: new Date() }).where(eq(t.ordenesTrabajo.id, ot.id));

  const fotos = fd.getAll("fotos").filter((f) => f instanceof File && f.size > 0);
  const n = await guardarFotos(s, fotos, { otId: ot.id, entidad: "incidencia", entidadId: inc.id });
  await auditar(s, "crear_incidencia", "incidencia", inc.id, { otId: ot.id, tipo });
  refrescar(ot.id);
  if (n < fotos.length) return { error: `Incidencia creada, pero ${fotos.length - n} foto(s) no se pudieron guardar (formato o tamaño no válido).` };
  return {};
}

export async function resolverIncidencia(incidenciaId: string, resolucion: string, descartar = false): Promise<R> {
  const s = await requireSesion("gestionTaller");
  const inc = await db.query.incidencias.findFirst({ where: and(eq(t.incidencias.tallerId, s.tid), eq(t.incidencias.id, incidenciaId)) });
  if (!inc) return { error: "Incidencia no encontrada" };
  await db
    .update(t.incidencias)
    .set({ estado: descartar ? "descartada" : "resuelta", resolucion: resolucion || null, resueltaPor: s.uid, resueltaEn: new Date() })
    .where(eq(t.incidencias.id, inc.id));
  await auditar(s, descartar ? "descartar_incidencia" : "resolver_incidencia", "incidencia", inc.id);
  refrescar(inc.otId);
  return {};
}

export async function subirFotosOT(fd: FormData): Promise<R> {
  const s = await requireSesion();
  const c = await cargarOT(s.tid, String(fd.get("otId")));
  if (!c) return { error: "Orden no encontrada" };
  const { ot } = c;
  if (ot.cerradaEn && !tiene(s.puestos, "oficina")) return { error: "La orden ya está cerrada" };
  const fotos = fd.getAll("fotos").filter((f) => f instanceof File && f.size > 0);
  const n = await guardarFotos(s, fotos, { otId: ot.id, entidad: "ot", entidadId: ot.id });
  if (n === 0) return { error: "No se ha podido guardar ninguna foto (formato o tamaño no válido)" };
  refrescar(ot.id);
  if (n < fotos.length) return { error: `${fotos.length - n} foto(s) no se pudieron guardar (formato o tamaño no válido).` };
  return {};
}

/** Apunta que se ha avisado al cliente de que el coche está listo (para no avisar dos veces). */
export async function marcarAvisadoListo(otId: string, canal: "whatsapp" | "llamada"): Promise<R> {
  const s = await requireSesion("oficina");
  const r = await db
    .update(t.ordenesTrabajo)
    .set({ avisadoListoEn: new Date() })
    .where(and(eq(t.ordenesTrabajo.tallerId, s.tid), eq(t.ordenesTrabajo.id, otId)))
    .returning({ id: t.ordenesTrabajo.id });
  if (!r.length) return { error: "Orden no encontrada" };
  await auditar(s, "avisar_listo", "ot", otId, { canal });
  refrescar(otId);
  return {};
}

/**
 * Corrige los datos de gestión de una orden abierta (trabajo, fecha prevista, datos del siniestro).
 * Los documentos ya firmados NO cambian: quedan como se firmaron y el cambio se registra en auditoría.
 */
export async function editarDatosOT(fd: FormData): Promise<R> {
  const s = await requireSesion("gestionTaller");
  const c = await cargarOT(s.tid, String(fd.get("otId")));
  if (!c) return { error: "Orden no encontrada" };
  const { ot } = c;
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  const txt = (k: string) => String(fd.get(k) ?? "").trim();

  const trabajo = txt("trabajo");
  if (trabajo.length < 3) return { error: "Describe el trabajo solicitado" };
  const fechaPrevista = txt("fechaPrevista") || null;
  if (fechaPrevista && (!FECHA.test(fechaPrevista) || isNaN(Date.parse(fechaPrevista)))) return { error: "Fecha prevista no válida" };

  let datosSiniestro = ot.datosSiniestro;
  if (fd.has("companiaId")) {
    const companiaId = txt("companiaId");
    const comp = companiaId
      ? await db.query.clientes.findFirst({ where: and(eq(t.clientes.tallerId, s.tid), eq(t.clientes.id, companiaId), inArray(t.clientes.tipo, ["aseguradora", "flota"])) })
      : null;
    if (companiaId && !comp) return { error: "Compañía no válida" };
    const fechaPeritaje = txt("fechaPeritaje");
    if (fechaPeritaje && !FECHA.test(fechaPeritaje)) return { error: "Fecha de peritaje no válida" };
    const franq = txt("franquicia").replace(",", ".");
    if (franq && (isNaN(Number(franq)) || Number(franq) < 0)) return { error: "Franquicia no válida" };
    datosSiniestro = {
      ...ot.datosSiniestro,
      companiaId: comp?.id,
      companiaNombre: comp?.nombre,
      numeroSiniestro: txt("numeroSiniestro") || undefined,
      numeroPoliza: txt("numeroPoliza") || undefined,
      perito: txt("perito") || undefined,
      fechaPeritaje: fechaPeritaje || undefined,
      franquicia: franq ? Number(franq) : undefined,
      cubreSustitucion: fd.get("cubreSustitucion") === "on",
    };
  }

  await db
    .update(t.ordenesTrabajo)
    .set({ trabajoSolicitado: trabajo, fechaPrevista, datosSiniestro, actualizadaEn: new Date() })
    .where(and(eq(t.ordenesTrabajo.id, ot.id), isNull(t.ordenesTrabajo.cerradaEn)));
  await auditar(s, "editar_ot", "ot", ot.id, {
    antes: { trabajo: ot.trabajoSolicitado, fechaPrevista: ot.fechaPrevista, siniestro: ot.datosSiniestro },
    despues: { trabajo, fechaPrevista, siniestro: datosSiniestro },
  });
  refrescar(ot.id);
  return {};
}

/**
 * Anula una orden abierta por error (duplicada, mal dada de alta, el coche no llegó a quedarse).
 * Solo administración. No es una entrega: se cierra con motivo y queda en el histórico como «Anulada».
 */
export async function anularOT(otId: string, motivo: string): Promise<R> {
  const s = await requireSesion("anularOrden");
  const c = await cargarOT(s.tid, otId);
  if (!c) return { error: "Orden no encontrada" };
  const { ot } = c;
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  const m = motivo.trim();
  if (m.length < 3) return { error: "Indica el motivo de la anulación" };
  const prestamo = await db.query.prestamos.findFirst({ where: and(eq(t.prestamos.tallerId, s.tid), eq(t.prestamos.otId, ot.id), isNull(t.prestamos.devueltoEn)) });
  if (prestamo) return { error: "Tiene un coche de sustitución prestado: registra antes la devolución" };

  const ahora = new Date();
  const r = await db
    .update(t.ordenesTrabajo)
    .set({ cerradaEn: ahora, anuladaEn: ahora, motivoAnulacion: m, actualizadaEn: ahora })
    .where(and(eq(t.ordenesTrabajo.id, ot.id), isNull(t.ordenesTrabajo.cerradaEn)))
    .returning({ id: t.ordenesTrabajo.id });
  if (!r.length) return { error: "La orden ya está cerrada" };
  await db.insert(t.historialEstados).values({ tallerId: s.tid, otId: ot.id, estadoId: ot.estadoId, usuarioId: s.uid, comentario: `ANULADA: ${m}` });
  await auditar(s, "anular_ot", "ot", ot.id, { motivo: m });
  refrescar(ot.id);
  return {};
}
