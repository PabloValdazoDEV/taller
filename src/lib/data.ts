import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/db";
import { diaISO, inicioDia } from "./formato";

/*
 * Capa de lectura. TODAS las consultas reciben el tallerId de la sesión y filtran por él.
 */

export async function tiposConEstados(tid: string) {
  const tipos = await db.select().from(t.tiposOrden).where(and(eq(t.tiposOrden.tallerId, tid), eq(t.tiposOrden.activo, true))).orderBy(asc(t.tiposOrden.orden));
  const estados = await db.select().from(t.estadosFlujo).where(eq(t.estadosFlujo.tallerId, tid)).orderBy(asc(t.estadosFlujo.orden));
  return tipos.map((tp) => ({ ...tp, estados: estados.filter((e) => e.tipoOrdenId === tp.id) }));
}
export type TipoConEstados = Awaited<ReturnType<typeof tiposConEstados>>[number];

const mecanico = alias(t.usuarios, "mecanico");

/** Consulta base de órdenes con todo lo que muestran las tarjetas. */
function consultaOTs(tid: string, filtro: SQL | undefined) {
  const incAbiertas = db
    .select({
      otId: t.incidencias.otId,
      n: sql<number>`count(*)::int`.as("n"),
      // Averías adicionales pendientes de que el cliente las apruebe (no bloquean, pero se avisan)
      averias: sql<number>`(count(*) filter (where ${t.incidencias.tipo} = 'averia_adicional'))::int`.as("averias"),
    })
    .from(t.incidencias)
    .where(and(eq(t.incidencias.tallerId, tid), inArray(t.incidencias.estado, ["abierta", "en_curso"])))
    .groupBy(t.incidencias.otId)
    .as("inc");

  return db
    .select({
      id: t.ordenesTrabajo.id,
      numero: t.ordenesTrabajo.numero,
      trabajo: t.ordenesTrabajo.trabajoSolicitado,
      fechaEntrada: t.ordenesTrabajo.fechaEntrada,
      fechaPrevista: t.ordenesTrabajo.fechaPrevista,
      cerradaEn: t.ordenesTrabajo.cerradaEn,
      anuladaEn: t.ordenesTrabajo.anuladaEn,
      avisadoListoEn: t.ordenesTrabajo.avisadoListoEn,
      actualizadaEn: t.ordenesTrabajo.actualizadaEn,
      datosSiniestro: t.ordenesTrabajo.datosSiniestro,
      tipoId: t.tiposOrden.id,
      tipoNombre: t.tiposOrden.nombre,
      tipoColor: t.tiposOrden.color,
      estadoId: t.estadosFlujo.id,
      estadoNombre: t.estadosFlujo.nombre,
      estadoOrden: t.estadosFlujo.orden,
      estadoMarca: t.estadosFlujo.marca,
      requiereAprobacion: t.estadosFlujo.requiereAprobacion,
      clienteId: t.clientes.id,
      clienteNombre: t.clientes.nombre,
      clienteTelefono: t.clientes.telefono,
      clienteAceptaWhatsapp: t.clientes.aceptaWhatsapp,
      clienteAceptaLlamada: t.clientes.aceptaLlamada,
      matricula: t.vehiculos.matricula,
      marca: t.vehiculos.marca,
      modelo: t.vehiculos.modelo,
      mecanicoId: mecanico.id,
      mecanicoNombre: mecanico.nombre,
      mecanicoColor: mecanico.color,
      incidenciasAbiertas: sql<number>`coalesce(${incAbiertas.n}, 0)`,
      averiasPendientes: sql<number>`coalesce(${incAbiertas.averias}, 0)`,
    })
    .from(t.ordenesTrabajo)
    .innerJoin(t.tiposOrden, eq(t.tiposOrden.id, t.ordenesTrabajo.tipoOrdenId))
    .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.ordenesTrabajo.estadoId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .leftJoin(mecanico, eq(mecanico.id, t.ordenesTrabajo.mecanicoId))
    .leftJoin(incAbiertas, eq(incAbiertas.otId, t.ordenesTrabajo.id))
    .where(and(eq(t.ordenesTrabajo.tallerId, tid), filtro));
}

export async function listarOTsAbiertas(tid: string, opts: { mecanicoId?: string } = {}) {
  return consultaOTs(tid, and(isNull(t.ordenesTrabajo.cerradaEn), opts.mecanicoId ? eq(t.ordenesTrabajo.mecanicoId, opts.mecanicoId) : undefined)).orderBy(
    asc(t.ordenesTrabajo.fechaPrevista),
    asc(t.ordenesTrabajo.fechaEntrada),
  );
}

/** Condición de búsqueda de órdenes por matrícula, nº de orden, cliente, teléfono o nº de siniestro. */
function filtroBusquedaOT(q: string) {
  const texto = q.trim();
  if (!texto) return undefined;
  const patron = `%${texto.replace(/[%_]/g, "")}%`;
  const matr = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digitos = texto.replace(/\D/g, "");
  return sql`(${t.ordenesTrabajo.numero} ilike ${patron} or ${t.clientes.nombre} ilike ${patron}
    ${matr.length >= 2 ? sql`or replace(upper(${t.vehiculos.matricula}), ' ', '') like ${"%" + matr + "%"}` : sql``}
    ${digitos.length >= 3 ? sql`or regexp_replace(coalesce(${t.clientes.telefono}, ''), '[^0-9]', '', 'g') like ${"%" + digitos + "%"}` : sql``}
    or (${t.ordenesTrabajo.datosSiniestro}->>'numeroSiniestro') ilike ${patron})`;
}

/** Búsqueda global: órdenes abiertas y entregadas (las entregadas, más recientes primero). */
export async function buscarOTs(tid: string, q: string, opts: { cerradas: boolean; limite?: number }) {
  return consultaOTs(tid, and(opts.cerradas ? isNotNull(t.ordenesTrabajo.cerradaEn) : isNull(t.ordenesTrabajo.cerradaEn), filtroBusquedaOT(q)))
    .orderBy(opts.cerradas ? desc(t.ordenesTrabajo.cerradaEn) : asc(t.ordenesTrabajo.fechaPrevista))
    .limit(opts.limite ?? 50);
}

export type OTResumen = Awaited<ReturnType<typeof listarOTsAbiertas>>[number];

export async function getOT(tid: string, id: string) {
  const asesor = alias(t.usuarios, "asesor");
  const [ot] = await db
    .select({
      ot: t.ordenesTrabajo,
      tipo: t.tiposOrden,
      estado: t.estadosFlujo,
      cliente: t.clientes,
      vehiculo: t.vehiculos,
      asesorNombre: asesor.nombre,
      mecanicoNombre: mecanico.nombre,
      mecanicoColor: mecanico.color,
    })
    .from(t.ordenesTrabajo)
    .innerJoin(t.tiposOrden, eq(t.tiposOrden.id, t.ordenesTrabajo.tipoOrdenId))
    .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.ordenesTrabajo.estadoId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .leftJoin(asesor, eq(asesor.id, t.ordenesTrabajo.asesorId))
    .leftJoin(mecanico, eq(mecanico.id, t.ordenesTrabajo.mecanicoId))
    .where(and(eq(t.ordenesTrabajo.tallerId, tid), eq(t.ordenesTrabajo.id, id)));
  if (!ot) return null;

  const usuarioH = alias(t.usuarios, "uh");
  const [estados, historialEst, asignaciones, recepcion, entrega, incidencias, archivos, documentos, prestamos, lineas, presupuestos] = await Promise.all([
    db.select().from(t.estadosFlujo).where(and(eq(t.estadosFlujo.tallerId, tid), eq(t.estadosFlujo.tipoOrdenId, ot.tipo.id))).orderBy(asc(t.estadosFlujo.orden)),
    db
      .select({ id: t.historialEstados.id, fecha: t.historialEstados.fecha, comentario: t.historialEstados.comentario, estado: t.estadosFlujo.nombre, usuario: usuarioH.nombre })
      .from(t.historialEstados)
      .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.historialEstados.estadoId))
      .leftJoin(usuarioH, eq(usuarioH.id, t.historialEstados.usuarioId))
      .where(and(eq(t.historialEstados.tallerId, tid), eq(t.historialEstados.otId, id)))
      .orderBy(desc(t.historialEstados.fecha)),
    // Cambios de mecánico (se registran en auditoría) para mostrarlos en el historial
    db
      .select({ id: t.auditoria.id, fecha: t.auditoria.fecha, datos: t.auditoria.datos, usuario: usuarioH.nombre })
      .from(t.auditoria)
      .leftJoin(usuarioH, eq(usuarioH.id, t.auditoria.usuarioId))
      .where(and(eq(t.auditoria.tallerId, tid), eq(t.auditoria.entidad, "ot"), eq(t.auditoria.entidadId, id), eq(t.auditoria.accion, "asignar_mecanico"))),
    db.query.recepciones.findFirst({ where: and(eq(t.recepciones.tallerId, tid), eq(t.recepciones.otId, id)) }),
    db.query.entregas.findFirst({ where: and(eq(t.entregas.tallerId, tid), eq(t.entregas.otId, id)) }),
    db
      .select({ i: t.incidencias, creadaPorNombre: usuarioH.nombre })
      .from(t.incidencias)
      .leftJoin(usuarioH, eq(usuarioH.id, t.incidencias.creadaPor))
      .where(and(eq(t.incidencias.tallerId, tid), eq(t.incidencias.otId, id)))
      .orderBy(desc(t.incidencias.creadaEn)),
    db.select().from(t.archivos).where(and(eq(t.archivos.tallerId, tid), eq(t.archivos.otId, id))).orderBy(asc(t.archivos.creadoEn)),
    db.select().from(t.documentos).where(and(eq(t.documentos.tallerId, tid), eq(t.documentos.otId, id))).orderBy(asc(t.documentos.creadoEn)),
    db
      .select({ p: t.prestamos, coche: t.cochesSustitucion })
      .from(t.prestamos)
      .innerJoin(t.cochesSustitucion, eq(t.cochesSustitucion.id, t.prestamos.cocheId))
      .where(and(eq(t.prestamos.tallerId, tid), eq(t.prestamos.otId, id)))
      .orderBy(desc(t.prestamos.salidaEn)),
    db.select().from(t.lineasOt).where(and(eq(t.lineasOt.tallerId, tid), eq(t.lineasOt.otId, id))).orderBy(asc(t.lineasOt.orden), asc(t.lineasOt.creadoEn)),
    db.select().from(t.presupuestos).where(and(eq(t.presupuestos.tallerId, tid), eq(t.presupuestos.otId, id))).orderBy(desc(t.presupuestos.version)),
  ]);

  const historial = [
    ...historialEst.map((h) => ({ ...h, tipo: "estado" as const })),
    ...asignaciones.map((a) => {
      const nombre = (a.datos as { nombre?: string | null } | null)?.nombre;
      return { id: a.id, fecha: a.fecha, usuario: a.usuario, comentario: null, estado: nombre ? `Asignado a ${nombre}` : "Sin mecánico asignado", tipo: "mecanico" as const };
    }),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  return { ...ot, estados, historial, recepcion, entrega, incidencias, archivos, documentos, prestamos, lineas, presupuestos };
}
export type OTDetalle = NonNullable<Awaited<ReturnType<typeof getOT>>>;

export async function mecanicos(tid: string) {
  return db
    .select({ id: t.usuarios.id, nombre: t.usuarios.nombre, color: t.usuarios.color })
    .from(t.usuarios)
    .where(and(eq(t.usuarios.tallerId, tid), sql`${"mecanico"} = any(${t.usuarios.puestos})`, eq(t.usuarios.activo, true)))
    .orderBy(asc(t.usuarios.nombre));
}

export async function compania(tid: string) {
  return db
    .select({ id: t.clientes.id, nombre: t.clientes.nombre, tipo: t.clientes.tipo })
    .from(t.clientes)
    .where(and(eq(t.clientes.tallerId, tid), inArray(t.clientes.tipo, ["aseguradora", "flota"])))
    .orderBy(asc(t.clientes.nombre));
}

export async function citasDelDia(tid: string, dia = diaISO()) {
  // Límites del día en hora de Madrid (el servidor puede estar en UTC)
  const ini = inicioDia(dia);
  const fin = inicioDia(diaISO(new Date(ini.getTime() + 36 * 3_600_000)));
  return db
    .select({ c: t.citas, tipoNombre: t.tiposOrden.nombre, tipoColor: t.tiposOrden.color })
    .from(t.citas)
    .leftJoin(t.tiposOrden, eq(t.tiposOrden.id, t.citas.tipoOrdenId))
    .where(and(eq(t.citas.tallerId, tid), gte(t.citas.fechaHora, ini), lt(t.citas.fechaHora, fin)))
    .orderBy(asc(t.citas.fechaHora));
}

export async function flotaSustitucion(tid: string) {
  const coches = await db
    .select()
    .from(t.cochesSustitucion)
    .where(and(eq(t.cochesSustitucion.tallerId, tid), eq(t.cochesSustitucion.activo, true)))
    .orderBy(asc(t.cochesSustitucion.matricula));
  const activos = await db
    .select({ p: t.prestamos, otNumero: t.ordenesTrabajo.numero, otId: t.ordenesTrabajo.id })
    .from(t.prestamos)
    .leftJoin(t.ordenesTrabajo, eq(t.ordenesTrabajo.id, t.prestamos.otId))
    .where(and(eq(t.prestamos.tallerId, tid), isNull(t.prestamos.devueltoEn)));
  return coches.map((c) => ({ ...c, prestamo: activos.find((a) => a.p.cocheId === c.id) ?? null }));
}

export async function buscarVehiculo(tid: string, matricula: string) {
  const m = normalizarMatricula(matricula);
  const [r] = await db
    .select({ vehiculo: t.vehiculos, cliente: t.clientes })
    .from(t.vehiculos)
    .leftJoin(t.clientes, eq(t.clientes.id, t.vehiculos.clienteId))
    .where(and(eq(t.vehiculos.tallerId, tid), sql`replace(upper(${t.vehiculos.matricula}), ' ', '') = ${m.replace(/ /g, "")}`));
  return r ?? null;
}

export function normalizarMatricula(m: string) {
  const limpia = m.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Formato actual 1234ABC → "1234 ABC"
  const mm = limpia.match(/^(\d{4})([A-Z]{3})$/);
  return mm ? `${mm[1]} ${mm[2]}` : limpia;
}

// ───────────────────────── Clientes ─────────────────────────

export type FiltroTipoCliente = "todos" | "particular" | "empresa" | "companias";

export async function listarClientes(tid: string, q: string, tipo: FiltroTipoCliente = "todos") {
  const CLIENTE_ID = sql.raw(`"clientes"."id"`); // calificado: se usa dentro de subconsultas
  const texto = q.trim();
  const patron = `%${texto.replace(/[%_]/g, "")}%`;
  const matr = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digitos = texto.replace(/\D/g, "");
  const filtroTipo =
    tipo === "companias" ? inArray(t.clientes.tipo, ["aseguradora", "flota"]) : tipo === "todos" ? undefined : eq(t.clientes.tipo, tipo);

  const busqueda = texto
    ? sql`(${t.clientes.nombre} ilike ${patron} or ${t.clientes.nif} ilike ${patron} or ${t.clientes.telefono} ilike ${patron}
          ${digitos.length >= 3 ? sql`or regexp_replace(coalesce(${t.clientes.telefono}, ''), '[^0-9]', '', 'g') like ${"%" + digitos + "%"}` : sql``}
          or ${t.clientes.email} ilike ${patron}
          or exists (select 1 from vehiculos v where v.cliente_id = ${CLIENTE_ID} and replace(upper(v.matricula), ' ', '') like ${"%" + matr + "%"}))`
    : undefined;

  return db
    .select({
      id: t.clientes.id,
      tipo: t.clientes.tipo,
      nombre: t.clientes.nombre,
      nif: t.clientes.nif,
      telefono: t.clientes.telefono,
      email: t.clientes.email,
      exentoIva: t.clientes.exentoIva,
      matriculas: sql<string[]>`coalesce((select array_agg(v.matricula order by v.matricula) from vehiculos v where v.cliente_id = ${CLIENTE_ID}), '{}')`,
      marcas: sql<string[]>`coalesce((select array_agg(coalesce(v.marca, '') order by v.matricula) from vehiculos v where v.cliente_id = ${CLIENTE_ID}), '{}')`,
      ordenes: sql<number>`(select count(*)::int from ordenes_trabajo o where o.cliente_id = ${CLIENTE_ID}
                            or (o.datos_siniestro->>'companiaId') = ${CLIENTE_ID}::text)`,
      abiertas: sql<number>`(select count(*)::int from ordenes_trabajo o where o.cerrada_en is null and (o.cliente_id = ${CLIENTE_ID}
                            or (o.datos_siniestro->>'companiaId') = ${CLIENTE_ID}::text))`,
      ultimaVisita: sql<Date | null>`(select max(o.fecha_entrada) from ordenes_trabajo o where o.cliente_id = ${CLIENTE_ID})`,
    })
    .from(t.clientes)
    .where(and(eq(t.clientes.tallerId, tid), filtroTipo, busqueda))
    .orderBy(sql`(select max(o.fecha_entrada) from ordenes_trabajo o where o.cliente_id = ${CLIENTE_ID}) desc nulls last`, asc(t.clientes.nombre))
    .limit(200);
}
export type ClienteResumen = Awaited<ReturnType<typeof listarClientes>>[number];

export async function getCliente(tid: string, id: string) {
  const cliente = await db.query.clientes.findFirst({ where: and(eq(t.clientes.tallerId, tid), eq(t.clientes.id, id)) });
  if (!cliente) return null;
  const esCompania = cliente.tipo === "aseguradora" || cliente.tipo === "flota";

  const [vehiculos, ordenes] = await Promise.all([
    db.select().from(t.vehiculos).where(and(eq(t.vehiculos.tallerId, tid), eq(t.vehiculos.clienteId, id))).orderBy(asc(t.vehiculos.matricula)),
    db
      .select({
        id: t.ordenesTrabajo.id,
        numero: t.ordenesTrabajo.numero,
        fechaEntrada: t.ordenesTrabajo.fechaEntrada,
        cerradaEn: t.ordenesTrabajo.cerradaEn,
        trabajo: t.ordenesTrabajo.trabajoSolicitado,
        datosSiniestro: t.ordenesTrabajo.datosSiniestro,
        clienteId: t.ordenesTrabajo.clienteId,
        clienteNombre: t.clientes.nombre,
        tipoNombre: t.tiposOrden.nombre,
        tipoColor: t.tiposOrden.color,
        estadoNombre: t.estadosFlujo.nombre,
        vehiculoId: t.vehiculos.id,
        matricula: t.vehiculos.matricula,
        marca: t.vehiculos.marca,
        modelo: t.vehiculos.modelo,
      })
      .from(t.ordenesTrabajo)
      .innerJoin(t.tiposOrden, eq(t.tiposOrden.id, t.ordenesTrabajo.tipoOrdenId))
      .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.ordenesTrabajo.estadoId))
      .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
      .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
      .where(
        and(
          eq(t.ordenesTrabajo.tallerId, tid),
          esCompania
            ? sql`(${t.ordenesTrabajo.clienteId} = ${id} or (${t.ordenesTrabajo.datosSiniestro}->>'companiaId') = ${id})`
            : eq(t.ordenesTrabajo.clienteId, id),
        ),
      )
      .orderBy(sql`${t.ordenesTrabajo.cerradaEn} is not null`, desc(t.ordenesTrabajo.fechaEntrada)),
  ]);

  const otIds = ordenes.map((o) => o.id);
  const [documentos, fotos] = otIds.length
    ? await Promise.all([
        db.select().from(t.documentos).where(and(eq(t.documentos.tallerId, tid), inArray(t.documentos.otId, otIds))).orderBy(desc(t.documentos.creadoEn)),
        db
          .select({ otId: t.archivos.otId, n: sql<number>`count(*)::int` })
          .from(t.archivos)
          .where(and(eq(t.archivos.tallerId, tid), inArray(t.archivos.otId, otIds)))
          .groupBy(t.archivos.otId),
      ])
    : [[], []];

  return { cliente, esCompania, vehiculos, ordenes, documentos, fotosPorOt: Object.fromEntries(fotos.map((f) => [f.otId, f.n])) };
}
export type ClienteDetalle = NonNullable<Awaited<ReturnType<typeof getCliente>>>;

// ───────────────────────── Configuración ─────────────────────────

export async function listarEmpleados(tid: string) {
  const U = sql.raw(`"usuarios"."id"`);
  return db
    .select({
      id: t.usuarios.id,
      nombre: t.usuarios.nombre,
      color: t.usuarios.color,
      puestos: t.usuarios.puestos,
      activo: t.usuarios.activo,
      trabajosAbiertos: sql<number>`(select count(*)::int from ordenes_trabajo o where o.mecanico_id = ${U} and o.cerrada_en is null)`,
    })
    .from(t.usuarios)
    .where(eq(t.usuarios.tallerId, tid))
    .orderBy(desc(t.usuarios.activo), asc(t.usuarios.nombre));
}
export type Empleado = Awaited<ReturnType<typeof listarEmpleados>>[number];

export async function listarCochesConfig(tid: string) {
  const C = sql.raw(`"coches_sustitucion"."id"`);
  return db
    .select({
      coche: t.cochesSustitucion,
      prestamos: sql<number>`(select count(*)::int from prestamos p where p.coche_id = ${C})`,
      ultimoPrestamo: sql<Date | null>`(select max(p.salida_en) from prestamos p where p.coche_id = ${C})`,
    })
    .from(t.cochesSustitucion)
    .where(eq(t.cochesSustitucion.tallerId, tid))
    .orderBy(desc(t.cochesSustitucion.activo), asc(t.cochesSustitucion.matricula));
}
export type CocheConfig = Awaited<ReturnType<typeof listarCochesConfig>>[number];

// ───────────────────────── Inicio por puestos ─────────────────────────

/** Vehículos entregados en los últimos `dias` (para facturación / dirección). */
export async function entregadosRecientes(tid: string, dias = 7) {
  const desde = new Date(Date.now() - dias * 86400_000);
  return db
    .select({
      id: t.ordenesTrabajo.id,
      numero: t.ordenesTrabajo.numero,
      cerradaEn: t.ordenesTrabajo.cerradaEn,
      datosSiniestro: t.ordenesTrabajo.datosSiniestro,
      tipoNombre: t.tiposOrden.nombre,
      tipoColor: t.tiposOrden.color,
      clienteNombre: t.clientes.nombre,
      clienteExento: t.clientes.exentoIva,
      matricula: t.vehiculos.matricula,
      marca: t.vehiculos.marca,
      modelo: t.vehiculos.modelo,
    })
    .from(t.ordenesTrabajo)
    .innerJoin(t.tiposOrden, eq(t.tiposOrden.id, t.ordenesTrabajo.tipoOrdenId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .where(and(eq(t.ordenesTrabajo.tallerId, tid), gte(t.ordenesTrabajo.cerradaEn, desde)))
    .orderBy(desc(t.ordenesTrabajo.cerradaEn));
}

/** Entradas y salidas desde el lunes de esta semana. */
export async function actividadSemana(tid: string) {
  // Lunes de esta semana a las 00:00 en hora de Madrid
  const hoy = Date.parse(diaISO());
  const lunes = inicioDia(diaISO(new Date(hoy - ((new Date(hoy).getUTCDay() + 6) % 7) * 86_400_000)));
  const [r] = await db
    .select({
      entradas: sql<number>`count(*) filter (where ${t.ordenesTrabajo.fechaEntrada} >= ${lunes.toISOString()})::int`,
      salidas: sql<number>`count(*) filter (where ${t.ordenesTrabajo.cerradaEn} >= ${lunes.toISOString()})::int`,
    })
    .from(t.ordenesTrabajo)
    .where(eq(t.ordenesTrabajo.tallerId, tid));
  return r;
}

/** Incidencias abiertas con su orden (para el jefe de taller / dirección). */
export async function incidenciasAbiertas(tid: string) {
  return db
    .select({
      id: t.incidencias.id,
      tipo: t.incidencias.tipo,
      descripcion: t.incidencias.descripcion,
      creadaEn: t.incidencias.creadaEn,
      otId: t.ordenesTrabajo.id,
      otNumero: t.ordenesTrabajo.numero,
      matricula: t.vehiculos.matricula,
    })
    .from(t.incidencias)
    .innerJoin(t.ordenesTrabajo, eq(t.ordenesTrabajo.id, t.incidencias.otId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .where(and(eq(t.incidencias.tallerId, tid), inArray(t.incidencias.estado, ["abierta", "en_curso"])))
    .orderBy(asc(t.incidencias.creadaEn));
}

/**
 * Buscador global (atención telefónica): matrícula, teléfono, nombre, NIF o nº de orden.
 * Devuelve las órdenes (abiertas primero) y los clientes que coinciden.
 */
export async function buscarGlobal(tid: string, q: string) {
  const texto = q.trim();
  if (texto.length < 2) return { ordenes: [], clientes: [] };
  const patron = `%${texto.replace(/[%_]/g, "")}%`;
  const compacto = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digitos = texto.replace(/\D/g, "");

  const coincide = sql`(
    replace(upper(${t.vehiculos.matricula}), ' ', '') like ${"%" + compacto + "%"}
    or ${t.clientes.nombre} ilike ${patron}
    or ${t.clientes.nif} ilike ${patron}
    or ${t.ordenesTrabajo.numero} ilike ${patron}
    ${digitos.length >= 6 ? sql`or regexp_replace(coalesce(${t.clientes.telefono}, ''), '\\D', '', 'g') like ${"%" + digitos + "%"}` : sql``}
    or (${t.ordenesTrabajo.datosSiniestro}->>'numeroSiniestro') ilike ${patron}
  )`;

  const ordenes = await db
    .select({
      id: t.ordenesTrabajo.id,
      numero: t.ordenesTrabajo.numero,
      trabajo: t.ordenesTrabajo.trabajoSolicitado,
      fechaEntrada: t.ordenesTrabajo.fechaEntrada,
      fechaPrevista: t.ordenesTrabajo.fechaPrevista,
      cerradaEn: t.ordenesTrabajo.cerradaEn,
      actualizadaEn: t.ordenesTrabajo.actualizadaEn,
      datosSiniestro: t.ordenesTrabajo.datosSiniestro,
      tipoNombre: t.tiposOrden.nombre,
      tipoColor: t.tiposOrden.color,
      estadoNombre: t.estadosFlujo.nombre,
      estadoMarca: t.estadosFlujo.marca,
      requiereAprobacion: t.estadosFlujo.requiereAprobacion,
      clienteId: t.clientes.id,
      clienteNombre: t.clientes.nombre,
      clienteTelefono: t.clientes.telefono,
      matricula: t.vehiculos.matricula,
      marca: t.vehiculos.marca,
      modelo: t.vehiculos.modelo,
      mecanicoNombre: mecanico.nombre,
      incidenciasCliente: sql<{ tipo: string; descripcion: string; nuevaFecha: string | null }[]>`coalesce((
        select json_agg(json_build_object('tipo', i.tipo, 'descripcion', i.descripcion, 'nuevaFecha', i.nueva_fecha) order by i.creada_en)
        from incidencias i where i.ot_id = ${t.ordenesTrabajo.id} and i.visible_cliente and i.estado in ('abierta', 'en_curso')
      ), '[]'::json)`,
    })
    .from(t.ordenesTrabajo)
    .innerJoin(t.tiposOrden, eq(t.tiposOrden.id, t.ordenesTrabajo.tipoOrdenId))
    .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.ordenesTrabajo.estadoId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .leftJoin(mecanico, eq(mecanico.id, t.ordenesTrabajo.mecanicoId))
    .where(and(eq(t.ordenesTrabajo.tallerId, tid), coincide))
    .orderBy(sql`${t.ordenesTrabajo.cerradaEn} is not null`, desc(t.ordenesTrabajo.fechaEntrada))
    .limit(20);

  const clientes = (await listarClientes(tid, texto)).slice(0, 10);
  return { ordenes, clientes };
}
export type ResultadoBusqueda = Awaited<ReturnType<typeof buscarGlobal>>;
