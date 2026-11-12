/*
 * Periodo de consulta para histórico y facturación: una semana (lunes a domingo), un mes o unas fechas.
 * En la URL: ?p=semana&dia=AAAA-MM-DD · ?p=mes&dia=AAAA-MM-DD · ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 */
import { diaISO } from "./formato";
import { sumarDias } from "./capacidad";

export type Periodo = {
  tipo: "semana" | "mes" | "rango";
  /** Primer y último día (incluidos), AAAA-MM-DD */
  desde: string;
  hasta: string;
  titulo: string;
  /** Parámetros para ir al periodo anterior / siguiente (no hay en «rango») */
  antes: string | null;
  despues: string | null;
  /** ¿Incluye hoy? */
  actual: boolean;
};

const valido = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const MES = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const corto = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const lunesDe = (d: string) => sumarDias(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));

export function leerPeriodo(sp: { p?: string; dia?: string; desde?: string; hasta?: string }, porDefecto: "semana" | "mes" = "mes"): Periodo {
  const hoy = diaISO();
  if (valido(sp.desde) && valido(sp.hasta)) {
    const [desde, hasta] = sp.desde! <= sp.hasta! ? [sp.desde!, sp.hasta!] : [sp.hasta!, sp.desde!];
    return { tipo: "rango", desde, hasta, titulo: `Del ${corto(desde)} al ${corto(hasta)}`, antes: null, despues: null, actual: desde <= hoy && hoy <= hasta };
  }
  const dia = valido(sp.dia) ? sp.dia! : hoy;
  const tipo = sp.p === "semana" || sp.p === "mes" ? sp.p : porDefecto;
  if (tipo === "semana") {
    const desde = lunesDe(dia);
    const hasta = sumarDias(desde, 6);
    const titulo = `Semana del ${Number(desde.slice(8))}/${desde.slice(5, 7)} al ${Number(hasta.slice(8))}/${hasta.slice(5, 7)}/${hasta.slice(0, 4)}`;
    return { tipo, desde, hasta, titulo, antes: `p=semana&dia=${sumarDias(desde, -7)}`, despues: `p=semana&dia=${sumarDias(desde, 7)}`, actual: desde <= hoy && hoy <= hasta };
  }
  const desde = `${dia.slice(0, 7)}-01`;
  const sig = `${sumarDias(desde, 32).slice(0, 7)}-01`;
  const hasta = sumarDias(sig, -1);
  const titulo = MES.format(new Date(`${desde}T12:00:00Z`));
  return { tipo: "mes", desde, hasta, titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), antes: `p=mes&dia=${sumarDias(desde, -1).slice(0, 7)}-01`, despues: `p=mes&dia=${sig}`, actual: desde <= hoy && hoy <= hasta };
}

/** Parámetros de URL de un periodo (para enlaces y para el CSV) */
export const paramsPeriodo = (p: Periodo) => (p.tipo === "rango" ? `desde=${p.desde}&hasta=${p.hasta}` : `p=${p.tipo}&dia=${p.desde}`);

/** Días entre dos instantes, por fecha de Madrid (0 = el mismo día) */
export const diasEntre = (a: Date | string, b: Date | string) => Math.round((Date.parse(diaISO(new Date(b))) - Date.parse(diaISO(new Date(a)))) / 86_400_000);

/** CSV para Excel en español: separado por «;», con BOM y decimales con coma. */
export function csv(filas: (string | number | null | undefined)[][]) {
  const celda = (v: string | number | null | undefined) => {
    const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}
