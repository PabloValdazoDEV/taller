import "server-only";
import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { db, t } from "@/db";
import { guardarFichero, leerFichero, sha256 } from "@/lib/storage";
import { infoCliente } from "@/lib/auth";
import type { Sesion } from "@/lib/session-token";
import type { Evidencia, TallerPdf } from "./plantillas";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Imagen guardada → data URL para el PDF. react-pdf solo admite PNG y JPEG (un logo WEBP se omite). */
async function imagenPdf(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  const ext = ruta.split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
  if (!mime) return null;
  try {
    return `data:${mime};base64,${(await leerFichero(ruta)).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function tallerParaPdf(tl: typeof t.talleres.$inferSelect): Promise<TallerPdf> {
  const [logo, sello] = await Promise.all([imagenPdf(tl.logoRuta), imagenPdf(tl.selloRuta)]);
  return { nombre: tl.nombre, razonSocial: tl.razonSocial, nif: tl.nif, direccion: tl.direccion, telefono: tl.telefono, email: tl.email, logo, sello };
}

/** Prepara las evidencias de la firma (antes de generar el PDF, que las incluye). */
export async function prepararEvidencia(s: Sesion, firmante: string): Promise<Evidencia> {
  const { ip, userAgent } = await infoCliente();
  return { firmante, fecha: new Date(), ip, dispositivo: userAgent, atendidoPor: s.nombre, documentoId: randomUUID() };
}

/**
 * Renderiza el PDF, lo guarda (inmutable) y registra su SHA-256.
 * Cualquier modificación posterior debe generar un documento nuevo (versión).
 */
export async function guardarDocumento(
  tx: Tx,
  s: Sesion,
  ev: Evidencia,
  tipo: (typeof t.tipoDocumentoEnum.enumValues)[number],
  otId: string | null,
  elemento: ReactElement,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await renderToBuffer(elemento as any);
  const ruta = await guardarFichero(s.tid, "documentos", pdf, "pdf");
  const [doc] = await tx
    .insert(t.documentos)
    .values({
      id: ev.documentoId,
      tallerId: s.tid,
      otId,
      tipo,
      ruta,
      sha256: sha256(pdf),
      firmanteNombre: ev.firmante,
      firmadoEn: ev.fecha,
      firmaIp: ev.ip,
      firmaDispositivo: ev.dispositivo,
      usuarioId: s.uid,
    })
    .returning();
  return doc;
}

/** Convierte fotos guardadas a data URL para incrustarlas en el PDF (solo JPEG/PNG). */
export async function fotosComoDataUrl(archivos: { ruta: string; mime: string }[], max = 8) {
  const out: string[] = [];
  for (const a of archivos) {
    if (out.length >= max) break;
    if (a.mime !== "image/jpeg" && a.mime !== "image/png") continue;
    const buf = await leerFichero(a.ruta);
    out.push(`data:${a.mime};base64,${buf.toString("base64")}`);
  }
  return out;
}

export function validarFirma(png: unknown): string | null {
  if (typeof png !== "string" || !png.startsWith("data:image/png;base64,")) return null;
  if (png.length < 2000 || png.length > 2_000_000) return null; // vacía o absurda
  return png;
}
