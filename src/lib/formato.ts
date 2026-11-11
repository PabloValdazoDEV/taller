export const fmtFecha = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fmtFechaHora = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const fmtKm = (km: number | null | undefined) => (km == null ? "—" : `${km.toLocaleString("es-ES")} km`);

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
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, "");
  if (n.length === 9) n = "34" + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
