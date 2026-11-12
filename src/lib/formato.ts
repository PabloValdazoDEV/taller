import { telefonoInternacional } from "./telefono";

/** Zona horaria del taller: el servidor puede estar en UTC, pero todo se muestra y calcula en hora de Madrid. */
export const ZONA = "Europe/Madrid";

/** Fecha de hoy (o de `d`) en hora de Madrid, formato YYYY-MM-DD. */
export const diaISO = (d: Date = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA }).format(d);

/** Días naturales transcurridos desde `d` hasta hoy (hora de Madrid). */
export const diasDesde = (d: Date | string) => Math.max(0, Math.round((Date.parse(diaISO()) - Date.parse(diaISO(new Date(d)))) / 86_400_000));

/** Instante en que empieza el día `diaIso` (YYYY-MM-DD) en hora de Madrid. */
export function inicioDia(diaIso: string) {
  const utc = new Date(`${diaIso}T00:00:00Z`);
  const enMadrid = Date.parse(utc.toLocaleString("en-US", { timeZone: ZONA }));
  const enUtc = Date.parse(utc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utc.getTime() - (enMadrid - enUtc));
}

/** Instante del día `diaIso` a la hora `hhmm` («09:30») en hora de Madrid (correcto también los días de cambio de hora). */
export function instanteMadrid(diaIso: string, hhmm: string) {
  const utc = new Date(`${diaIso}T${hhmm}:00Z`);
  const enMadrid = Date.parse(utc.toLocaleString("en-US", { timeZone: ZONA }));
  const enUtc = Date.parse(utc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utc.getTime() - (enMadrid - enUtc));
}

export const fmtHora = (d: Date | string) => new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });

export const fmtFecha = (d: Date | string | null | undefined) =>
  d
    ? // Las fechas sin hora («2026-11-12») se muestran tal cual, sin desplazarlas por zona horaria
      typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? d.split("-").reverse().join("/")
      : new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA })
    : "—";

export const fmtFechaHora = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: ZONA,
      })
    : "—";

/** Separador de miles con punto, también a partir de 1.000 (es-ES no agrupa los números de 4 cifras). */
export const fmtMiles = (n: number | string | null | undefined) =>
  n == null || n === "" ? "" : String(n).replace(/\D/g, "").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const fmtKm = (km: number | null | undefined) => (km == null ? "—" : `${fmtMiles(km)} km`);

export const fmtCombustible = (octavos: number | null | undefined) => {
  if (octavos == null) return "—";
  const nombres: Record<number, string> = { 0: "Reserva", 2: "1/4", 4: "1/2", 6: "3/4", 8: "Lleno" };
  return nombres[octavos] ?? `${octavos}/8`;
};

export const TIPO_INCIDENCIA: Record<string, string> = {
  averia_adicional: "Avería adicional",
  retraso_piezas: "Retraso de piezas",
  dano_taller: "Daño en el taller",
  reclamacion: "Reclamación / garantía",
};

export const TIPO_DOCUMENTO: Record<string, string> = {
  resguardo: "Resguardo de depósito",
  presupuesto: "Presupuesto",
  entrega: "Acta de entrega",
  proforma: "Proforma",
  prestamo_salida: "Contrato préstamo coche sustitución",
  prestamo_devolucion: "Devolución coche sustitución",
};

export const TIPOS_DANO = ["Arañazo", "Abolladura", "Rotura", "Pintura", "Óxido", "Otro"] as const;

/** Edad en años completos a fecha de hoy */
export function aniosDesde(fechaISO: string, hoy = new Date()) {
  const f = new Date(fechaISO);
  let a = hoy.getFullYear() - f.getFullYear();
  const m = hoy.getMonth() - f.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) a--;
  return a;
}

/** Enlace wa.me con mensaje (envío manual desde el móvil del taller, sin API) */
export function enlaceWhatsapp(telefono: string | null | undefined, texto: string) {
  const n = telefonoInternacional(telefono);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
