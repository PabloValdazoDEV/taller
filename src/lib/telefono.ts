/** Prefijos internacionales más habituales entre la clientela; +34 por defecto. */
export const PREFIJOS = [
  { p: "+34", pais: "España", bandera: "🇪🇸" },
  { p: "+351", pais: "Portugal", bandera: "🇵🇹" },
  { p: "+33", pais: "Francia", bandera: "🇫🇷" },
  { p: "+39", pais: "Italia", bandera: "🇮🇹" },
  { p: "+49", pais: "Alemania", bandera: "🇩🇪" },
  { p: "+44", pais: "Reino Unido", bandera: "🇬🇧" },
  { p: "+40", pais: "Rumanía", bandera: "🇷🇴" },
  { p: "+359", pais: "Bulgaria", bandera: "🇧🇬" },
  { p: "+380", pais: "Ucrania", bandera: "🇺🇦" },
  { p: "+212", pais: "Marruecos", bandera: "🇲🇦" },
  { p: "+86", pais: "China", bandera: "🇨🇳" },
  { p: "+57", pais: "Colombia", bandera: "🇨🇴" },
  { p: "+593", pais: "Ecuador", bandera: "🇪🇨" },
  { p: "+51", pais: "Perú", bandera: "🇵🇪" },
  { p: "+58", pais: "Venezuela", bandera: "🇻🇪" },
  { p: "+54", pais: "Argentina", bandera: "🇦🇷" },
  { p: "+591", pais: "Bolivia", bandera: "🇧🇴" },
  { p: "+595", pais: "Paraguay", bandera: "🇵🇾" },
  { p: "+53", pais: "Cuba", bandera: "🇨🇺" },
  { p: "+1", pais: "EE. UU. / Canadá", bandera: "🇺🇸" },
] as const;

export const PREFIJO_DEFECTO = "+34";

/** Separa un teléfono guardado en prefijo + número. Sin prefijo se asume +34. */
export function separarTelefono(tel: string | null | undefined): { prefijo: string; numero: string } {
  const v = (tel ?? "").trim();
  if (!v) return { prefijo: PREFIJO_DEFECTO, numero: "" };
  const limpio = v.replace(/^00/, "+");
  if (limpio.startsWith("+")) {
    const pref = [...PREFIJOS].sort((a, b) => b.p.length - a.p.length).find((x) => limpio.replace(/\s/g, "").startsWith(x.p));
    if (pref) return { prefijo: pref.p, numero: limpio.slice(limpio.indexOf(pref.p) + pref.p.length).trim() };
    const m = limpio.match(/^\+(\d{1,3})\s*(.*)$/);
    if (m) return { prefijo: `+${m[1]}`, numero: m[2] };
  }
  return { prefijo: PREFIJO_DEFECTO, numero: v };
}

/** Une prefijo + número para guardar ("+34 600 123 456"). Vacío si no hay número. */
export function unirTelefono(prefijo: string, numero: string): string {
  const n = numero.trim();
  return n ? `${prefijo} ${n}` : "";
}

/** Solo dígitos, con prefijo internacional (para wa.me / tel:). */
export function telefonoInternacional(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const { prefijo, numero } = separarTelefono(tel);
  const d = numero.replace(/\D/g, "");
  return d ? prefijo.replace("+", "") + d : null;
}
