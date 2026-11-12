import { inicioDia } from "@/lib/formato";
import { sumarDias } from "@/lib/capacidad";
import { diasEntre, type Periodo } from "@/lib/periodo";
import type { CochePeriodo } from "@/lib/historico";

export const FILTROS = [
  { v: "todos", t: "Todos" },
  { v: "entraron", t: "Entraron" },
  { v: "entregados", t: "Entregados" },
  { v: "taller", t: "Siguen en el taller" },
] as const;
export type Filtro = (typeof FILTROS)[number]["v"];

/** Qué le pasó a cada coche en el periodo y cuántos días ha estado (o lleva) en el taller */
export function clasificar(lista: CochePeriodo[], p: Periodo) {
  const ini = inicioDia(p.desde).getTime();
  const fin = inicioDia(sumarDias(p.hasta, 1)).getTime();
  return lista.map((o) => {
    const entro = o.fechaEntrada.getTime() >= ini && o.fechaEntrada.getTime() < fin;
    const salio = !!o.cerradaEn && !o.anuladaEn && o.cerradaEn.getTime() >= ini && o.cerradaEn.getTime() < fin;
    return { ...o, entro, salio, enTaller: !o.cerradaEn, dias: diasEntre(o.fechaEntrada, o.cerradaEn ?? new Date()) };
  });
}
export type Fila = ReturnType<typeof clasificar>[number];

export const pasaFiltro = (o: Fila, f: Filtro) => (f === "entraron" ? o.entro && !o.anuladaEn : f === "entregados" ? o.salio : f === "taller" ? o.enTaller : true);
