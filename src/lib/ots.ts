import { diaISO } from "./formato";

type OTMin = { fechaPrevista: string | null; estadoMarca: string | null; requiereAprobacion: boolean; estadoNombre: string; averiasPendientes?: number };

/** Fecha prevista ya pasada (hora de Madrid) y el coche aún no está listo. */
export const esRetrasada = (o: OTMin) => !!o.fechaPrevista && o.fechaPrevista < diaISO() && o.estadoMarca !== "listo";

/** Esperando que el cliente apruebe (el presupuesto o una avería adicional) o que pase el perito. */
export const esperaAprobacionOPerito = (o: OTMin) => o.requiereAprobacion || (o.averiasPendientes ?? 0) > 0 || /peritaje|perito/i.test(o.estadoNombre);
