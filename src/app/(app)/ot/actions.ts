"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { tiene } from "@/lib/puestos";
import { requireSesion } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { guardarFotos } from "@/lib/fotos";

type R = { error?: string };

async function cargarOT(tid: string, otId: string) {
  const ot = await db.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, tid), eq(t.ordenesTrabajo.id, otId)) });
  if (!ot) throw new Error("Orden no encontrada");
  const estados = await db.select().from(t.estadosFlujo).where(and(eq(t.estadosFlujo.tallerId, tid), eq(t.estadosFlujo.tipoOrdenId, ot.tipoOrdenId))).orderBy(asc(t.estadosFlujo.orden));
  return { ot, estados };
}

function refrescar(otId: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/ot/${otId}`);
}

export async function cambiarEstado(otId: string, estadoId: string | null, comentario?: string): Promise<R> {
  const s = await requireSesion();
  const { ot, estados } = await cargarOT(s.tid, otId);
  if (ot.cerradaEn) return { error: "La orden ya está cerrada" };
  if (!tiene(s.puestos, "gestionTaller") && ot.mecanicoId !== s.uid) return { error: "Solo puedes mover tus propios trabajos" };

  const actual = estados.find((e) => e.id === ot.estadoId)!;
  // estadoId null = avanzar al siguiente
  const destino = estadoId ? estados.find((e) => e.id === estadoId) : estados.find((e) => e.orden > actual.orden);
  if (!destino) return { error: "No hay estado siguiente" };
  if (destino.marca === "final") return { error: "Para entregar el vehículo usa «Entregar» (requiere firma)" };
  if (!tiene(s.puestos, "gestionTaller") && destino.orden < actual.orden) return { error: "Pide al jefe de taller que retroceda el estado" };

  await db.transaction(async (tx) => {
    await tx.update(t.ordenesTrabajo).set({ estadoId: destino.id, actualizadaEn: new Date() }).where(eq(t.ordenesTrabajo.id, ot.id));
    await tx.insert(t.historialEstados).values({ tallerId: s.tid, otId: ot.id, estadoId: destino.id, usuarioId: s.uid, comentario: comentario || null });
  });
  await auditar(s, "cambiar_estado", "ot", ot.id, { de: actual.nombre, a: destino.nombre });
  refrescar(ot.id);
  return {};
}

export async function asignarMecanico(otId: string, mecanicoId: string | null): Promise<R> {
  const s = await requireSesion("gestionTaller");
  const { ot } = await cargarOT(s.tid, otId);
  if (mecanicoId) {
    const m = await db.query.usuarios.findFirst({ where: and(eq(t.usuarios.tallerId, s.tid), eq(t.usuarios.id, mecanicoId)) });
    if (!m) return { error: "Mecánico no válido" };
  }
  await db.update(t.ordenesTrabajo).set({ mecanicoId, actualizadaEn: new Date() }).where(eq(t.ordenesTrabajo.id, ot.id));
  await auditar(s, "asignar_mecanico", "ot", ot.id, { mecanicoId });
  refrescar(ot.id);
  return {};
}

export async function crearIncidencia(fd: FormData): Promise<R> {
  const s = await requireSesion();
  const otId = String(fd.get("otId"));
  const { ot } = await cargarOT(s.tid, otId);
  const tipo = String(fd.get("tipo")) as (typeof t.tipoIncidenciaEnum.enumValues)[number];
  if (!t.tipoIncidenciaEnum.enumValues.includes(tipo)) return { error: "Tipo no válido" };
  const descripcion = String(fd.get("descripcion") ?? "").trim();
  if (descripcion.length < 3) return { error: "Describe la incidencia" };
  const nuevaFecha = String(fd.get("nuevaFecha") ?? "") || null;

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

  await guardarFotos(s, fd.getAll("fotos"), { otId: ot.id, entidad: "incidencia", entidadId: inc.id });
  await auditar(s, "crear_incidencia", "incidencia", inc.id, { otId: ot.id, tipo });
  refrescar(ot.id);
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
  const otId = String(fd.get("otId"));
  const { ot } = await cargarOT(s.tid, otId);
  const n = await guardarFotos(s, fd.getAll("fotos"), { otId: ot.id, entidad: "ot", entidadId: ot.id });
  if (n === 0) return { error: "No se ha recibido ninguna foto" };
  refrescar(ot.id);
  return {};
}
