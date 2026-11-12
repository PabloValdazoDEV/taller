import "server-only";
/* Consultas del histórico de coches y del resumen de facturación (por periodo). */
import { and, asc, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/db";
import { inicioDia } from "./formato";
import { sumarDias } from "./capacidad";

const OT = sql.raw(`"ordenes_trabajo"."id"`);

/** Órdenes que han estado en el taller en el periodo: entraron antes de que acabe y no salieron antes de que empiece. */
export async function cochesPeriodo(tid: string, desde: string, hasta: string) {
  const ini = inicioDia(desde);
  const fin = inicioDia(sumarDias(hasta, 1));
  const mecanico = alias(t.usuarios, "mecanico");
  return db
    .select({
      id: t.ordenesTrabajo.id,
      numero: t.ordenesTrabajo.numero,
      fechaEntrada: t.ordenesTrabajo.fechaEntrada,
      cerradaEn: t.ordenesTrabajo.cerradaEn,
      anuladaEn: t.ordenesTrabajo.anuladaEn,
      trabajo: t.ordenesTrabajo.trabajoSolicitado,
      companiaNombre: sql<string | null>`${t.ordenesTrabajo.datosSiniestro}->>'companiaNombre'`,
      tipoId: t.tiposOrden.id,
      tipoNombre: t.tiposOrden.nombre,
      tipoColor: t.tiposOrden.color,
      estado: t.estadosFlujo.nombre,
      clienteNombre: t.clientes.nombre,
      matricula: t.vehiculos.matricula,
      marca: t.vehiculos.marca,
      modelo: t.vehiculos.modelo,
      mecanico: mecanico.nombre,
      total: sql<number | null>`(select p.total from proformas p where p.ot_id = ${OT} and p.estado = 'vigente' limit 1)`,
      facturaExterna: sql<string | null>`(select p.factura_externa from proformas p where p.ot_id = ${OT} and p.estado = 'vigente' limit 1)`,
      sinReparar: sql<boolean>`exists (select 1 from entregas e where e.ot_id = ${OT} and e.motivo_sin_reparar is not null)`,
    })
    .from(t.ordenesTrabajo)
    .innerJoin(t.tiposOrden, eq(t.tiposOrden.id, t.ordenesTrabajo.tipoOrdenId))
    .innerJoin(t.estadosFlujo, eq(t.estadosFlujo.id, t.ordenesTrabajo.estadoId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .leftJoin(mecanico, eq(mecanico.id, t.ordenesTrabajo.mecanicoId))
    .where(and(eq(t.ordenesTrabajo.tallerId, tid), lt(t.ordenesTrabajo.fechaEntrada, fin), or(isNull(t.ordenesTrabajo.cerradaEn), gte(t.ordenesTrabajo.cerradaEn, ini))))
    .orderBy(desc(t.ordenesTrabajo.fechaEntrada));
}
export type CochePeriodo = Awaited<ReturnType<typeof cochesPeriodo>>[number];

/** Proformas vigentes del periodo (por su fecha) con lo cobrado, y cobros del periodo por forma de pago. */
export async function facturacionPeriodo(tid: string, desde: string, hasta: string) {
  const ini = inicioDia(desde);
  const fin = inicioDia(sumarDias(hasta, 1));
  const cobrado = (q: "cliente" | "compania") =>
    sql<number>`coalesce((select sum(cb.importe) from cobros cb where cb.ot_id = ${OT} and cb.pagador = ${q} and cb.anulado_en is null), 0)::int`;
  const [proformas, cobros] = await Promise.all([
    db
      .select({
        id: t.proformas.id,
        numero: t.proformas.numero,
        fecha: t.proformas.creadoEn,
        base: t.proformas.base,
        iva: t.proformas.iva,
        total: t.proformas.total,
        ivaModo: t.proformas.ivaModo,
        reparto: t.proformas.reparto,
        facturaExterna: t.proformas.facturaExterna,
        otId: t.ordenesTrabajo.id,
        otNumero: t.ordenesTrabajo.numero,
        entregada: t.ordenesTrabajo.cerradaEn,
        clienteNombre: t.clientes.nombre,
        clienteNif: t.clientes.nif,
        matricula: t.vehiculos.matricula,
        cobradoCliente: cobrado("cliente"),
        cobradoCompania: cobrado("compania"),
      })
      .from(t.proformas)
      .innerJoin(t.ordenesTrabajo, eq(t.ordenesTrabajo.id, t.proformas.otId))
      .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
      .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
      .where(and(eq(t.proformas.tallerId, tid), eq(t.proformas.estado, "vigente"), isNull(t.ordenesTrabajo.anuladaEn), gte(t.proformas.creadoEn, ini), lt(t.proformas.creadoEn, fin)))
      .orderBy(asc(t.proformas.creadoEn)),
    db
      .select({ metodo: t.cobros.metodo, pagador: t.cobros.pagador, importe: sql<number>`sum(${t.cobros.importe})::int`, n: sql<number>`count(*)::int` })
      .from(t.cobros)
      .where(and(eq(t.cobros.tallerId, tid), isNull(t.cobros.anuladoEn), gte(t.cobros.fecha, ini), lt(t.cobros.fecha, fin)))
      .groupBy(t.cobros.metodo, t.cobros.pagador),
  ]);
  return {
    proformas: proformas.map((p) => ({
      ...p,
      pendienteCliente: Math.max(0, p.reparto.cliente - p.cobradoCliente),
      pendienteCompania: Math.max(0, p.reparto.compania - p.cobradoCompania),
    })),
    cobros,
  };
}
export type ProformaPeriodo = Awaited<ReturnType<typeof facturacionPeriodo>>["proformas"][number];
