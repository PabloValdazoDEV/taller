// Puestos de trabajo combinables y permisos que otorgan. Sin dependencias de servidor: se usa también en el cliente.
// Una persona puede tener varios puestos (p. ej. recepción + teléfono + facturación); sus permisos y su
// pantalla de inicio son la suma de los de todos ellos.

export const PUESTOS = ["direccion", "recepcion", "telefono", "facturacion", "jefe_taller", "mecanico"] as const;
export type Puesto = (typeof PUESTOS)[number];

export const INFO_PUESTO: Record<Puesto, { nombre: string; descripcion: string }> = {
  direccion: { nombre: "Dirección", descripcion: "Ve todo y configura el taller: empleados, coches de sustitución, datos y textos legales." },
  recepcion: { nombre: "Recepción", descripcion: "Citas, recepción de vehículos con firma, entregas y coches de sustitución." },
  telefono: { nombre: "Atención al cliente", descripcion: "Atiende llamadas: busca cualquier coche al momento y sabe qué contar al cliente." },
  facturacion: { nombre: "Facturación", descripcion: "Proformas, cobros y paso de datos al programa de facturación." },
  jefe_taller: { nombre: "Jefe de taller", descripcion: "Reparte el trabajo, mueve estados, controla la calidad y resuelve incidencias." },
  mecanico: { nombre: "Mecánico", descripcion: "Ve sus trabajos en el móvil, los avanza y abre incidencias con fotos." },
};

const OFICINA: Puesto[] = ["direccion", "recepcion", "telefono", "facturacion", "jefe_taller"];

const PERMISOS = {
  /** Pantalla de inicio de oficina, ficha completa de la orden, buscador */
  oficina: OFICINA,
  /** Recibir y entregar vehículos, préstamos de coches de sustitución */
  recepcion: ["direccion", "recepcion", "jefe_taller"],
  clientes: OFICINA,
  tablero: [...OFICINA, "mecanico"],
  misTrabajos: ["mecanico", "jefe_taller", "direccion"],
  /** Asignar mecánicos, resolver incidencias, retroceder estados */
  gestionTaller: ["direccion", "recepcion", "jefe_taller"],
  /** Prestar un coche aunque el conductor no cumpla las condiciones */
  forzarPrestamo: ["direccion", "jefe_taller"],
  sustitucion: ["direccion", "recepcion", "telefono", "jefe_taller"],
  configuracion: ["direccion"],
  /** Ver y editar los importes (mano de obra, piezas, IVA) */
  importes: ["direccion", "recepcion", "facturacion", "jefe_taller"],
  /** Anular una orden dada de alta por error */
  anularOrden: ["direccion"],
} satisfies Record<string, Puesto[]>;
export type Permiso = keyof typeof PERMISOS;

export function tiene(puestos: readonly Puesto[], permiso: Permiso) {
  return puestos.some((p) => (PERMISOS[permiso] as readonly Puesto[]).includes(p));
}

/** Cifras del PIN según los puestos: las cuentas con más permisos (dirección, jefe de taller) llevan un PIN más largo. */
export const longitudPin = (puestos: readonly Puesto[]) => (puestos.includes("direccion") || puestos.includes("jefe_taller") ? 6 : 4);

/** Pantalla a la que va cada persona al entrar. */
export function inicioDe(puestos: readonly Puesto[]) {
  return tiene(puestos, "oficina") ? "/" : "/mis-trabajos";
}

export function nombresPuestos(puestos: readonly Puesto[]) {
  return PUESTOS.filter((p) => puestos.includes(p)).map((p) => INFO_PUESTO[p].nombre).join(" · ");
}

export function esPuesto(v: unknown): v is Puesto {
  return typeof v === "string" && (PUESTOS as readonly string[]).includes(v);
}
