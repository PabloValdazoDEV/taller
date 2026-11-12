import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSesion } from "@/lib/auth";
import { getOT } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { Matricula, Tarjeta } from "@/components/ui";
import { TIPO_INCIDENCIA } from "@/lib/formato";
import { FormularioEntrega } from "./formulario";
import { tiene } from "@/lib/puestos";
import { fmtCantidad, ivaDeOT, totales } from "@/lib/importes";
import { resumenCobro } from "@/lib/cobros";
import { Cobros } from "../cobros";

export const dynamic = "force-dynamic";

export default async function Entrega({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sinReparar?: string }> }) {
  const s = await requireSesion("recepcion");
  const { id } = await params;
  const sinReparar = (await searchParams).sinReparar === "1";
  const ot = await getOT(s.tid, id);
  if (!ot) notFound();
  const taller = await tallerPorId(s.tid);

  const prestamoActivo = ot.prestamos.find((p) => !p.p.devueltoEn);
  const bloqueo = ot.ot.cerradaEn
    ? "Esta orden ya está entregada."
    : ot.estado.marca !== "listo" && !sinReparar
      ? `El vehículo está en «${ot.estado.nombre}». Debe estar «Listo para entregar» (o usa «Retira sin reparar»).`
      : prestamoActivo
        ? `Antes de entregar, registra la devolución del coche de sustitución ${prestamoActivo.coche.matricula}.`
        : null;
  const incAbiertas = ot.incidencias.filter(({ i }) => i.estado === "abierta" || i.estado === "en_curso");

  // Paso 1: importe y cobro (si la orden tiene importes en la app)
  const iva = ivaDeOT(ot.ot, ot.cliente, taller);
  const totalActual = totales(ot.lineas, iva.modo, iva.pct, iva.preciosConIva).total;
  const cobros = ot.cobros.map(({ c, usuario }) => ({
    id: c.id, pagador: c.pagador, metodo: c.metodo, importe: c.importe, nota: c.nota, fecha: c.fecha.toISOString(), usuario, anulado: !!c.anuladoEn,
  }));
  const conImportes = ot.lineas.length > 0;
  const ultimoAceptado = ot.presupuestos.find((p) => p.estado === "aprobado");
  const aceptado = ot.presupuestos.length ? { numero: ultimoAceptado?.numero ?? null, total: ultimoAceptado?.total ?? 0 } : null;
  const resumen = ot.proforma ? resumenCobro(ot.proforma, ot.cobros.map(({ c }) => c)) : null;
  const faltaProforma = !conImportes ? null : !ot.proforma ? "Genera la proforma (paso 1) antes de entregar." : ot.proforma.total !== totalActual ? "Los importes han cambiado: actualiza la proforma (paso 1)." : null;
  // Las piezas presupuestadas se proponen como «piezas sustituidas»
  const piezas = ot.lineas.filter((l) => l.tipo === "pieza").map((l) => (Number(l.cantidad) === 1 ? l.descripcion : `${l.descripcion} (${fmtCantidad(l.cantidad)})`)).join(", ");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <Link href={`/ot/${ot.ot.id}`} className="text-sm text-slate-500">← Orden {ot.ot.numero}</Link>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-3 flex-wrap">
          {sinReparar ? "Retira sin reparar" : "Entrega"} <Matricula grande>{ot.vehiculo.matricula}</Matricula>
        </h1>
        <p className="text-slate-600">{ot.vehiculo.marca} {ot.vehiculo.modelo} · {ot.cliente.nombre}</p>
      </div>
      {prestamoActivo && (
        <Tarjeta className="p-4 bg-amber-50 border-amber-200 text-sm">
          Coche de sustitución pendiente de devolver: <Link className="font-semibold underline" href={`/sustitucion/${prestamoActivo.p.id}/devolucion`}>registrar devolución</Link>
        </Tarjeta>
      )}
      {sinReparar && (
        <Tarjeta className="p-4 bg-red-50 border-red-200 text-sm text-red-900">
          El cliente se lleva el vehículo en el estado actual (<b>{ot.estado.nombre}</b>). El acta lo indicará claramente y la orden quedará cerrada.
        </Tarjeta>
      )}
      {incAbiertas.length > 0 && (
        <Tarjeta className="p-4 bg-amber-50 border-amber-200 text-sm">
          Hay {incAbiertas.length} incidencia(s) sin cerrar: {incAbiertas.map(({ i }) => TIPO_INCIDENCIA[i.tipo]).join(", ")}. Revísalas antes de entregar.
        </Tarjeta>
      )}
      {conImportes && tiene(s.puestos, "importes") && (
        <Cobros
          titulo="1. Importe y cobro"
          otId={ot.ot.id}
          proforma={ot.proforma ? { id: ot.proforma.id, numero: ot.proforma.numero, total: ot.proforma.total, reparto: ot.proforma.reparto, facturaExterna: ot.proforma.facturaExterna, creadoEn: ot.proforma.creadoEn.toISOString(), conformidadExceso: ot.proforma.conformidadExceso } : null}
          cobros={cobros}
          totalActual={totalActual}
          hayLineas
          abierta={!ot.ot.cerradaEn}
          aceptado={aceptado}
        />
      )}
      <FormularioEntrega
        piezas={piezas}
        pendienteCliente={resumen?.cliente.pendiente ?? 0}
        otId={ot.ot.id}
        kmEntrada={ot.recepcion?.km ?? null}
        trabajoSugerido={sinReparar ? "" : ot.ot.trabajoSolicitado}
        sinReparar={sinReparar}
        garantia={taller.config.garantiaTexto ?? ""}
        firmante={ot.cliente.tipo === "particular" ? ot.cliente.nombre : ""}
        bloqueo={bloqueo ?? faltaProforma}
      />
    </div>
  );
}
