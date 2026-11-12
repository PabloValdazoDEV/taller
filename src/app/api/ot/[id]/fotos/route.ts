// ZIP con todas las fotos de una orden (para el perito o la compañía): recepción, durante el trabajo y entrega,
// más los documentos firmados y una ficha con los datos del siniestro.
import { zipSync, strToU8, type Zippable } from "fflate";
import { getSesion } from "@/lib/auth";
import { tiene } from "@/lib/puestos";
import { getOT } from "@/lib/data";
import { leerFichero } from "@/lib/storage";
import { fmtFecha, fmtFechaHora, TIPO_DOCUMENTO } from "@/lib/formato";
import { auditar } from "@/lib/auditoria";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };
const CARPETA = (entidad: string) => (entidad === "recepcion" ? "1 Recepcion" : entidad === "entrega" ? "3 Entrega" : "2 Durante el trabajo");
const limpio = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .-]+/g, "").trim();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSesion();
  if (!s) return new Response("No autorizado", { status: 401 });
  if (!tiene(s.puestos, "oficina")) return new Response("Sin permiso", { status: 403 });
  const { id } = await params;
  const ot = await getOT(s.tid, id);
  if (!ot) return new Response("No encontrado", { status: 404 });

  const sin = ot.ot.datosSiniestro;
  const ficha = [
    `Orden: ${ot.ot.numero}`,
    `Matrícula: ${ot.vehiculo.matricula}`,
    `Vehículo: ${[ot.vehiculo.marca, ot.vehiculo.modelo].filter(Boolean).join(" ")}`,
    ot.vehiculo.bastidor ? `Bastidor: ${ot.vehiculo.bastidor}` : null,
    `Entrada: ${fmtFechaHora(ot.ot.fechaEntrada)}`,
    sin?.companiaNombre ? `Compañía: ${sin.companiaNombre}` : null,
    sin?.numeroSiniestro ? `Nº siniestro: ${sin.numeroSiniestro}` : null,
    sin?.numeroPoliza ? `Nº póliza: ${sin.numeroPoliza}` : null,
    sin?.perito ? `Perito: ${sin.perito}` : null,
    sin?.fechaPeritaje ? `Fecha de peritaje: ${fmtFecha(sin.fechaPeritaje)}` : null,
    "",
    `Trabajo solicitado: ${ot.ot.trabajoSolicitado}`,
    "",
    `Fotos: ${ot.archivos.length}`,
  ].filter((l) => l !== null).join("\r\n");

  const zip: Zippable = { "Datos.txt": strToU8(ficha) };
  const usados = new Set<string>();
  const nombreUnico = (base: string) => {
    let n = base, i = 2;
    while (usados.has(n)) n = base.replace(/(\.\w+)$/, ` (${i++})$1`);
    usados.add(n);
    return n;
  };
  const contador: Record<string, number> = {};
  for (const a of ot.archivos) {
    const carpeta = CARPETA(a.entidad);
    contador[carpeta] = (contador[carpeta] ?? 0) + 1;
    const fecha = fmtFechaHora(a.creadoEn).replace(/[/:]/g, "-").replace(/,/g, "");
    const nombre = nombreUnico(`${carpeta}/${String(contador[carpeta]).padStart(2, "0")} ${fecha}.${EXT[a.mime] ?? "jpg"}`);
    try {
      zip[nombre] = [new Uint8Array(await leerFichero(a.ruta)), { level: 0 }]; // las fotos ya van comprimidas
    } catch {
      /* fichero perdido: se omite */
    }
  }
  for (const d of ot.documentos) {
    try {
      zip[nombreUnico(`Documentos/${limpio(TIPO_DOCUMENTO[d.tipo] ?? "Documento")}.pdf`)] = [new Uint8Array(await leerFichero(d.ruta)), { level: 0 }];
    } catch {
      /* se omite */
    }
  }

  await auditar(s, "descargar_fotos", "ot", ot.ot.id, { fotos: ot.archivos.length });
  const nombre = limpio(`Fotos ${ot.vehiculo.matricula.replace(/\s/g, "")} ${sin?.numeroSiniestro ? `siniestro ${sin.numeroSiniestro}` : ot.ot.numero}`) + ".zip";
  return new Response(new Uint8Array(zipSync(zip)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
