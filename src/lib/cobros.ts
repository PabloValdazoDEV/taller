/*
 * Reparto del importe entre pagadores y estado de los cobros de una orden (todo en céntimos).
 * La proforma fija el total y quién paga qué; los cobros se apuntan contra la orden.
 */
import type { DatosSiniestro, RepartoPago } from "@/db/schema";

export const METODOS_COBRO = ["efectivo", "tarjeta", "transferencia", "bizum"] as const;
export type MetodoCobro = (typeof METODOS_COBRO)[number];
export const NOMBRE_METODO: Record<MetodoCobro, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", bizum: "Bizum" };

/**
 * Reparto por defecto: si hay compañía (siniestro, renting, flota), el cliente paga la franquicia
 * (si la hay y sin pasar del total) y la compañía el resto; si no, todo el cliente.
 */
export function repartoPorDefecto(total: number, siniestro: DatosSiniestro | null | undefined): RepartoPago {
  const compania = siniestro?.companiaNombre ?? null;
  if (!compania) return { cliente: total, compania: 0, companiaNombre: null };
  const franquicia = Math.max(0, Math.round((Number(siniestro?.franquicia) || 0) * 100));
  const cliente = Math.min(franquicia, total);
  return { cliente, compania: total - cliente, companiaNombre: compania };
}

type CobroMin = { pagador: "cliente" | "compania"; importe: number; anuladoEn: Date | string | null };

export type ResumenCobro = {
  total: number;
  cliente: { debe: number; pagado: number; pendiente: number };
  compania: { debe: number; pagado: number; pendiente: number; nombre: string | null };
  pendiente: number;
  estado: "sin_cobrar" | "parcial" | "cobrado";
};

export function resumenCobro(p: { total: number; reparto: RepartoPago }, cobros: CobroMin[]): ResumenCobro {
  const activos = cobros.filter((c) => !c.anuladoEn);
  const pagado = (q: "cliente" | "compania") => activos.filter((c) => c.pagador === q).reduce((s, c) => s + c.importe, 0);
  const cli = pagado("cliente");
  const comp = pagado("compania");
  const cliente = { debe: p.reparto.cliente, pagado: cli, pendiente: Math.max(0, p.reparto.cliente - cli) };
  const compania = { debe: p.reparto.compania, pagado: comp, pendiente: Math.max(0, p.reparto.compania - comp), nombre: p.reparto.companiaNombre };
  const pendiente = cliente.pendiente + compania.pendiente;
  return { total: p.total, cliente, compania, pendiente, estado: pendiente === 0 ? "cobrado" : cli + comp > 0 ? "parcial" : "sin_cobrar" };
}
