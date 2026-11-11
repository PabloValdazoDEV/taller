// Resuelve el taller a partir del subdominio (valrodri.miapp.es → "valrodri").
// En local (localhost / IP) se usa DEFAULT_TALLER_SLUG.
export function slugDesdeHost(host: string | null): string {
  const def = process.env.DEFAULT_TALLER_SLUG ?? "demo";
  if (!host) return def;
  const h = host.split(":")[0];
  if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return def;
  const partes = h.split(".");
  if (partes.length >= 3 && partes[0] !== "www") return partes[0];
  return def;
}
