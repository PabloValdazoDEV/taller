// Flujos iniciales que recibe cada taller nuevo (luego son configurables).
export type EstadoBase = { nombre: string; saltable?: boolean; aprobacion?: boolean; notifica?: boolean; marca?: "listo" | "final" };
export type FlujoBase = { codigo: string; nombre: string; color: string; siniestro?: boolean; estados: EstadoBase[] };

const cierre: EstadoBase[] = [
  { nombre: "Control de calidad" },
  { nombre: "Listo para entregar", notifica: true, marca: "listo" },
  { nombre: "Entregado", marca: "final" },
];

export const FLUJOS_BASE: FlujoBase[] = [
  {
    codigo: "mantenimiento",
    nombre: "Mantenimiento",
    color: "#0891b2",
    estados: [{ nombre: "Recepcionado" }, { nombre: "En reparación" }, ...cierre],
  },
  {
    codigo: "averia",
    nombre: "Avería / golpe particular",
    color: "#ea580c",
    estados: [
      { nombre: "Recepcionado" },
      { nombre: "En diagnóstico" },
      { nombre: "Pendiente de aprobación", aprobacion: true, notifica: true },
      { nombre: "Esperando piezas", saltable: true },
      { nombre: "En reparación" },
      ...cierre,
    ],
  },
  {
    codigo: "siniestro",
    nombre: "Siniestro aseguradora",
    color: "#7c3aed",
    siniestro: true,
    estados: [
      { nombre: "Recepcionado" },
      { nombre: "Pendiente de peritaje" },
      { nombre: "Peritado", aprobacion: true },
      { nombre: "Esperando piezas", saltable: true },
      { nombre: "Chapa", saltable: true },
      { nombre: "Pintura", saltable: true },
      { nombre: "Montaje" },
      ...cierre,
    ],
  },
  {
    codigo: "renting",
    nombre: "Renting / flota",
    color: "#db2777",
    siniestro: true,
    estados: [
      { nombre: "Recepcionado" },
      { nombre: "Pendiente de autorización", aprobacion: true },
      { nombre: "Esperando piezas", saltable: true },
      { nombre: "En reparación" },
      ...cierre,
    ],
  },
  {
    codigo: "lunas",
    nombre: "Lunas / parabrisas",
    color: "#0284c7",
    estados: [{ nombre: "Recepcionado" }, { nombre: "Esperando luna", saltable: true }, { nombre: "Sustitución / reparación" }, ...cierre.slice(1)],
  },
  {
    codigo: "neumaticos",
    nombre: "Neumáticos",
    color: "#475569",
    estados: [{ nombre: "Recepcionado" }, { nombre: "En montaje" }, ...cierre.slice(1)],
  },
  {
    codigo: "garantia",
    nombre: "Garantía / reclamación",
    color: "#dc2626",
    estados: [{ nombre: "Recepcionado" }, { nombre: "En diagnóstico" }, { nombre: "En reparación" }, ...cierre],
  },
];

export const TEXTOS_LEGALES_BASE = {
  textoResguardo:
    "El cliente deposita el vehículo descrito para la realización de los trabajos indicados y declara conformes el estado, kilometraje, nivel de combustible y daños registrados. " +
    "El taller no se responsabiliza de objetos no declarados. Conforme al RD 1457/1986, el cliente tiene derecho a presupuesto escrito, salvo renuncia expresa, y a recibir las piezas sustituidas si así lo solicita. " +
    "Existen hojas de reclamaciones a disposición del cliente. Sus datos se tratarán por el taller para la gestión del servicio (RGPD); puede ejercer sus derechos dirigiéndose al taller.",
  textoEntrega:
    "El cliente recibe el vehículo y declara su conformidad con los trabajos realizados y el estado del mismo. Las reparaciones están garantizadas en los términos indicados.",
  textoPresupuesto:
    "La aceptación de este presupuesto autoriza al taller a realizar los trabajos descritos por el importe indicado. Cualquier trabajo adicional que resulte necesario se comunicará al cliente y requerirá su aprobación previa. " +
    "Conforme al RD 1457/1986, el cliente puede solicitar las piezas sustituidas. Sus datos se tratarán por el taller para la gestión del servicio (RGPD).",
  garantiaTexto: "Garantía de 3 meses o 2.000 km (lo que antes se cumpla) sobre los trabajos realizados, según RD 1457/1986.",
  textoPrestamo:
    "El taller cede temporalmente el vehículo de sustitución al conductor indicado, que se compromete a devolverlo en el mismo estado, con el mismo nivel de combustible, " +
    "a usarlo conforme a la ley y a responder de las sanciones de tráfico y daños ocasionados durante el préstamo no cubiertos por el seguro.",
  prestamoEdadMinima: 25,
  prestamoAniosCarnet: 2,
};
