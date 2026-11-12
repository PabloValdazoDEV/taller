import "server-only";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { db, t } from "@/db";
import { secreto } from "./session-token";
import { urlBase } from "./enlaces";
import { diaISO } from "./formato";
import { infoCliente } from "./auth";
import { tallerPorId } from "./taller";
import { TEXTOS_LEGALES_BASE } from "./flujos-base";
import { guardarDocumento, prepararEvidencia, tallerParaPdf } from "./pdf/generar";
import { PresupuestoPdf, type DatosPresupuesto } from "./pdf/plantillas";
import { cambiosAmpliacion } from "./ampliacion";

/** Validez mínima del presupuesto (RD 1457/1986): 12 días hábiles. */
export const DIAS_HABILES_VALIDEZ = 12;

/** Suma días hábiles (lunes a viernes) a una fecha AAAA-MM-DD. No descuenta festivos. */
export function sumarDiasHabiles(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  let quedan = n;
  while (quedan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const sem = d.getUTCDay();
    if (sem !== 0 && sem !== 6) quedan--;
  }
  return d.toISOString().slice(0, 10);
}

export const caducado = (p: { validezHasta: string }) => p.validezHasta < diaISO();

// ── Enlace público para que el cliente vea y acepte el presupuesto desde su móvil ──
const clave = () => new TextEncoder().encode(secreto() + ":presupuestos");

export async function enlacePresupuesto(p: { id: string; tallerId: string; validezHasta: string }) {
  // Caduca al día siguiente del fin de la validez (la página ya avisa de que ha caducado)
  const exp = Math.floor(new Date(`${p.validezHasta}T23:59:59Z`).getTime() / 1000) + 86_400;
  const token = await new SignJWT({ p: p.id, t: p.tallerId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(clave());
  return `${await urlBase()}/p/${token}`;
}

export async function verificarTokenPresupuesto(token: string): Promise<{ id: string; tallerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, clave());
    return { id: String(payload.p), tallerId: String(payload.t) };
  } catch {
    return null;
  }
}

/** Presupuesto con lo necesario para mostrarlo o generar su PDF. */
export async function cargarPresupuesto(tid: string, id: string) {
  const [r] = await db
    .select({ p: t.presupuestos, ot: t.ordenesTrabajo, cliente: t.clientes, vehiculo: t.vehiculos, emisor: t.usuarios.nombre })
    .from(t.presupuestos)
    .innerJoin(t.ordenesTrabajo, eq(t.ordenesTrabajo.id, t.presupuestos.otId))
    .innerJoin(t.clientes, eq(t.clientes.id, t.ordenesTrabajo.clienteId))
    .innerJoin(t.vehiculos, eq(t.vehiculos.id, t.ordenesTrabajo.vehiculoId))
    .leftJoin(t.usuarios, eq(t.usuarios.id, t.presupuestos.creadoPor))
    .where(and(eq(t.presupuestos.tallerId, tid), eq(t.presupuestos.id, id)));
  if (!r) return null;
  const [taller, anterior] = await Promise.all([
    tallerPorId(tid),
    r.p.ampliaId ? db.query.presupuestos.findFirst({ where: and(eq(t.presupuestos.tallerId, tid), eq(t.presupuestos.id, r.p.ampliaId)) }) : null,
  ]);
  // Ampliación: el presupuesto aceptado al que amplía y lo que cambia
  const ampliacion = anterior ? { numero: anterior.numero, total: anterior.total, cambios: cambiosAmpliacion(anterior.lineas, r.p.lineas) } : null;
  return { ...r, taller, ampliacion };
}
export type PresupuestoCargado = NonNullable<Awaited<ReturnType<typeof cargarPresupuesto>>>;

const VIA: Record<string, string> = { tablet: "firmado en el taller", enlace: "aceptado por enlace", manual: "sin firma" };

/** Texto de situación para el PDF sin firmar. */
export function situacion(p: PresupuestoCargado["p"]) {
  if (p.estado === "aprobado") return `Aprobado ${VIA[p.decididoVia ?? "manual"]}${p.decididoNombre ? ` por ${p.decididoNombre}` : ""} el ${new Date(p.decididoEn!).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}${p.decisionNota ? ` (${p.decisionNota})` : ""}`;
  if (p.estado === "rechazado") return `No aceptado${p.decisionNota ? `: ${p.decisionNota}` : ""}`;
  if (p.estado === "sustituido") return "Sustituido por un presupuesto posterior";
  if (p.estado === "borrado") return "Anulado por el taller";
  return undefined;
}

export async function datosPdf(c: PresupuestoCargado, firma?: { evidencia: DatosPresupuesto["evidencia"]; firmaPng: string }): Promise<DatosPresupuesto> {
  const { p, ot, cliente, vehiculo, taller } = c;
  return {
    taller: await tallerParaPdf(taller),
    evidencia: firma?.evidencia,
    firmaPng: firma?.firmaPng,
    numero: p.numero,
    numeroOT: ot.numero,
    tipo: p.tipo,
    creadoEn: p.creadoEn,
    validezHasta: p.validezHasta,
    cliente,
    vehiculo,
    trabajoSolicitado: ot.trabajoSolicitado,
    ampliacion: c.ampliacion,
    horasEstimadas: p.horasEstimadas,
    fechaEntrega: p.fechaEntrega,
    lineas: p.lineas,
    modo: p.ivaModo,
    pct: p.ivaPct,
    motivoExencion: p.motivoExencion,
    preciosConIva: p.preciosConIva,
    base: p.base,
    iva: p.iva,
    total: p.total,
    situacion: firma ? undefined : situacion(p),
    textoLegal: taller.config.textoPresupuesto || TEXTOS_LEGALES_BASE.textoPresupuesto,
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Si la orden está parada en un estado «requiere aprobación», pasa al siguiente (queda en el historial). */
async function avanzarTrasAprobacion(tx: Tx, tid: string, otId: string, uid: string | null, comentario: string) {
  const ot = await tx.query.ordenesTrabajo.findFirst({ where: and(eq(t.ordenesTrabajo.tallerId, tid), eq(t.ordenesTrabajo.id, otId)) });
  if (!ot || ot.cerradaEn) return null;
  const estados = await tx.select().from(t.estadosFlujo).where(and(eq(t.estadosFlujo.tallerId, tid), eq(t.estadosFlujo.tipoOrdenId, ot.tipoOrdenId))).orderBy(asc(t.estadosFlujo.orden));
  const actual = estados.find((e) => e.id === ot.estadoId);
  if (!actual?.requiereAprobacion) return null;
  const siguiente = estados.find((e) => e.orden > actual.orden && e.marca !== "final");
  if (!siguiente) return null;
  const r = await tx
    .update(t.ordenesTrabajo)
    .set({ estadoId: siguiente.id, actualizadaEn: new Date() })
    .where(and(eq(t.ordenesTrabajo.id, otId), eq(t.ordenesTrabajo.estadoId, actual.id)))
    .returning({ id: t.ordenesTrabajo.id });
  if (!r.length) return null;
  await tx.insert(t.historialEstados).values({ tallerId: tid, otId, estadoId: siguiente.id, usuarioId: uid, comentario });
  return siguiente.nombre;
}

class Conflicto extends Error {}

/**
 * Registra la decisión del cliente sobre un presupuesto pendiente.
 * - aceptar con firma (tablet o enlace): genera el PDF firmado con su huella SHA-256;
 * - aceptar sin firma (oficina: teléfono, aseguradora, perito): exige nota;
 * - rechazar.
 * Si se acepta y la orden espera aprobación, avanza al siguiente estado.
 */
export async function decidirPresupuesto(opts: {
  tid: string;
  presupuestoId: string;
  decision: "aprobado" | "rechazado";
  via: "tablet" | "enlace" | "manual";
  nombre: string;
  nota?: string | null;
  firmaPng?: string | null;
  /** Empleado (tablet o manual); null si es el cliente por enlace */
  usuario: { uid: string; nombre: string } | null;
}): Promise<{ error?: string; estadoNuevo?: string | null }> {
  const c = await cargarPresupuesto(opts.tid, opts.presupuestoId);
  if (!c) return { error: "Presupuesto no encontrado" };
  if (c.p.estado !== "pendiente")
    return {
      error:
        c.p.estado === "aprobado" ? "Este presupuesto ya está aceptado"
        : c.p.estado === "rechazado" ? "Este presupuesto ya se rechazó"
        : c.p.estado === "borrado" ? "Este presupuesto ya no está disponible: pida al taller el actualizado"
        : "Este presupuesto se ha sustituido por otro más reciente",
    };
  if (c.ot.cerradaEn) return { error: "La orden ya está cerrada" };
  if (opts.decision === "aprobado" && caducado(c.p)) return { error: "El presupuesto ha caducado: pide al taller uno actualizado" };

  const { ip, userAgent } = await infoCliente();
  // Quien «atiende» en el PDF: el empleado de la tablet o, por enlace, quien emitió el presupuesto
  const ev = opts.firmaPng ? await prepararEvidencia({ nombre: opts.usuario?.nombre ?? c.emisor ?? c.taller.nombre }, opts.nombre) : null;
  const pdf = ev ? PresupuestoPdf(await datosPdf(c, { evidencia: ev, firmaPng: opts.firmaPng! })) : null;
  const ahora = new Date();
  try {
    const estadoNuevo = await db.transaction(async (tx) => {
      const doc = ev && pdf ? await guardarDocumento(tx, { tid: opts.tid, uid: opts.usuario?.uid ?? null }, ev, "presupuesto", c.ot.id, pdf) : null;
      const r = await tx
        .update(t.presupuestos)
        .set({
          estado: opts.decision,
          decididoEn: ahora,
          decididoVia: opts.via,
          decididoNombre: opts.nombre,
          decididoPor: opts.usuario?.uid ?? null,
          decisionNota: opts.nota?.trim() || null,
          decisionIp: ip,
          decisionDispositivo: userAgent.slice(0, 300),
          documentoId: doc?.id ?? null,
        })
        .where(and(eq(t.presupuestos.id, c.p.id), eq(t.presupuestos.estado, "pendiente")))
        .returning({ id: t.presupuestos.id });
      if (!r.length) throw new Conflicto("Este presupuesto acaba de cambiar. Recarga la página.");
      await tx.insert(t.auditoria).values({
        tallerId: opts.tid,
        usuarioId: opts.usuario?.uid ?? null,
        accion: opts.decision === "aprobado" ? "aprobar_presupuesto" : "rechazar_presupuesto",
        entidad: "ot",
        entidadId: c.ot.id,
        datos: { presupuesto: c.p.numero, via: opts.via, nombre: opts.nombre, nota: opts.nota ?? null, total: c.p.total },
        ip,
        userAgent,
      });
      if (opts.decision !== "aprobado") return null;
      // Al aceptar: la fecha de entrega del presupuesto pasa a la orden…
      if (c.p.fechaEntrega && c.p.fechaEntrega !== c.ot.fechaPrevista)
        await tx.update(t.ordenesTrabajo).set({ fechaPrevista: c.p.fechaEntrega, actualizadaEn: ahora }).where(eq(t.ordenesTrabajo.id, c.ot.id));
      // …y las averías adicionales abiertas antes del presupuesto quedan aprobadas con él
      await tx
        .update(t.incidencias)
        .set({ estado: "resuelta", resolucion: `Aprobada por el cliente en el presupuesto ${c.p.numero}`, resueltaEn: ahora, resueltaPor: opts.usuario?.uid ?? null })
        .where(and(eq(t.incidencias.tallerId, opts.tid), eq(t.incidencias.otId, c.ot.id), eq(t.incidencias.tipo, "averia_adicional"), inArray(t.incidencias.estado, ["abierta", "en_curso"]), lte(t.incidencias.creadaEn, c.p.creadoEn)));
      const como = opts.via === "manual" ? `sin firma${opts.nota ? `: ${opts.nota}` : ""}` : opts.via === "tablet" ? "firmado en el taller" : "por enlace";
      return avanzarTrasAprobacion(tx, opts.tid, c.ot.id, opts.usuario?.uid ?? null, `Presupuesto ${c.p.numero} aceptado por ${opts.nombre} (${como})`);
    });
    return { estadoNuevo };
  } catch (e) {
    if (e instanceof Conflicto) return { error: e.message };
    throw e;
  }
}

/** PDF del presupuesto: el firmado (archivado, con comprobación de integridad) o, si no hay firma, generado al vuelo. */
export async function pdfPresupuesto(c: PresupuestoCargado): Promise<Response> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { leerFichero, sha256 } = await import("./storage");
  let pdf: Buffer;
  if (c.p.documentoId) {
    const d = await db.query.documentos.findFirst({ where: and(eq(t.documentos.tallerId, c.p.tallerId), eq(t.documentos.id, c.p.documentoId)) });
    if (!d) return new Response("Documento no encontrado", { status: 404 });
    pdf = await leerFichero(d.ruta);
    if (sha256(pdf) !== d.sha256) return new Response("El documento no supera la verificación de integridad.", { status: 409 });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf = await renderToBuffer(PresupuestoPdf(await datosPdf(c)) as any);
  }
  const nombre = `Presupuesto ${c.p.numero} ${c.vehiculo.matricula.replace(/\s/g, "")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
