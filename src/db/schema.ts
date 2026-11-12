import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  numeric,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Puesto } from "@/lib/puestos";

/*
 * Multi-taller: todas las tablas de negocio llevan taller_id.
 * La capa de datos (src/lib/data) filtra SIEMPRE por el taller de la sesión.
 * Pendiente (fase 0 de producción): políticas Row Level Security en PostgreSQL.
 */

export const tipoClienteEnum = pgEnum("tipo_cliente", ["particular", "empresa", "aseguradora", "flota"]);
export const tipoIncidenciaEnum = pgEnum("tipo_incidencia", [
  "averia_adicional",
  "retraso_piezas",
  "dano_taller",
  "reclamacion",
]);
export const estadoIncidenciaEnum = pgEnum("estado_incidencia", ["abierta", "en_curso", "resuelta", "descartada"]);
export const tipoDocumentoEnum = pgEnum("tipo_documento", [
  "resguardo",
  "presupuesto",
  "entrega",
  "proforma",
  "prestamo_salida",
  "prestamo_devolucion",
]);
export const estadoCocheEnum = pgEnum("estado_coche", ["disponible", "prestado", "mantenimiento"]);
export const pagadorEnum = pgEnum("pagador", ["aseguradora", "cortesia", "cliente"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });
const id = () => uuid("id").primaryKey().defaultRandom();
const tallerId = () =>
  uuid("taller_id")
    .notNull()
    .references(() => talleres.id);

export const talleres = pgTable("talleres", {
  id: id(),
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  razonSocial: text("razon_social"),
  nif: text("nif"),
  direccion: text("direccion"),
  telefono: text("telefono"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  logoRuta: text("logo_ruta"),
  /** Sello o firma del taller: se estampa en el recuadro «Por el taller» de los PDF. Privado (no se sirve sin sesión). */
  selloRuta: text("sello_ruta"),
  colorPrimario: text("color_primario").notNull().default("#1d4ed8"),
  ivaDefecto: numeric("iva_defecto").notNull().default("21"),
  /** textos legales, condiciones de préstamo, etc. */
  config: jsonb("config").$type<TallerConfig>().notNull().default({}),
  creadoEn: ts("creado_en").notNull().defaultNow(),
});

export type TallerConfig = {
  textoResguardo?: string;
  textoEntrega?: string;
  textoPrestamo?: string;
  garantiaTexto?: string;
  prestamoEdadMinima?: number;
  prestamoAniosCarnet?: number;
  /** Horario de atención, se usa en los mensajes al cliente */
  horario?: string;
};

export const usuarios = pgTable(
  "usuarios",
  {
    id: id(),
    tallerId: tallerId(),
    nombre: text("nombre").notNull(),
    email: text("email"),
    passwordHash: text("password_hash"),
    pinHash: text("pin_hash").notNull(),
    /** Puestos combinables (ver src/lib/puestos.ts) */
    puestos: text("puestos").array().$type<Puesto[]>().notNull().default(sql`'{}'::text[]`),
    color: text("color").notNull().default("#64748b"),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [index("usuarios_taller_idx").on(t.tallerId)],
);

export const clientes = pgTable(
  "clientes",
  {
    id: id(),
    tallerId: tallerId(),
    tipo: tipoClienteEnum("tipo").notNull().default("particular"),
    nombre: text("nombre").notNull(),
    nif: text("nif"),
    telefono: text("telefono"),
    email: text("email"),
    direccion: text("direccion"),
    exentoIva: boolean("exento_iva").notNull().default(false),
    motivoExencion: text("motivo_exencion"),
    aceptaWhatsapp: boolean("acepta_whatsapp").notNull().default(false),
    aceptaEmail: boolean("acepta_email").notNull().default(false),
    notas: text("notas"),
    creadoEn: ts("creado_en").notNull().defaultNow(),
  },
  (t) => [index("clientes_taller_idx").on(t.tallerId)],
);

export const vehiculos = pgTable(
  "vehiculos",
  {
    id: id(),
    tallerId: tallerId(),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    matricula: text("matricula").notNull(),
    bastidor: text("bastidor"),
    marca: text("marca"),
    modelo: text("modelo"),
    anio: integer("anio"),
    combustible: text("combustible"),
    color: text("color"),
    kmUltimo: integer("km_ultimo"),
  },
  (t) => [uniqueIndex("vehiculos_taller_matricula_uq").on(t.tallerId, t.matricula)],
);

export const tiposOrden = pgTable("tipos_orden", {
  id: id(),
  tallerId: tallerId(),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  color: text("color").notNull().default("#64748b"),
  orden: integer("orden").notNull().default(0),
  /** pide datos de siniestro/autorización (aseguradora o renting) */
  requiereSiniestro: boolean("requiere_siniestro").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
});

export const estadosFlujo = pgTable(
  "estados_flujo",
  {
    id: id(),
    tallerId: tallerId(),
    tipoOrdenId: uuid("tipo_orden_id")
      .notNull()
      .references(() => tiposOrden.id),
    nombre: text("nombre").notNull(),
    orden: integer("orden").notNull(),
    saltable: boolean("saltable").notNull().default(false),
    requiereAprobacion: boolean("requiere_aprobacion").notNull().default(false),
    notificaCliente: boolean("notifica_cliente").notNull().default(false),
    /** "listo" = vehículo listo para entregar; "final" = entregado */
    marca: text("marca"),
  },
  (t) => [index("estados_tipo_idx").on(t.tipoOrdenId, t.orden)],
);

export type DatosSiniestro = {
  companiaId?: string;
  companiaNombre?: string;
  numeroSiniestro?: string;
  numeroPoliza?: string;
  perito?: string;
  fechaPeritaje?: string;
  franquicia?: number;
  cubreSustitucion?: boolean;
};

export const ordenesTrabajo = pgTable(
  "ordenes_trabajo",
  {
    id: id(),
    tallerId: tallerId(),
    numero: text("numero").notNull(),
    tipoOrdenId: uuid("tipo_orden_id")
      .notNull()
      .references(() => tiposOrden.id),
    estadoId: uuid("estado_id")
      .notNull()
      .references(() => estadosFlujo.id),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    vehiculoId: uuid("vehiculo_id")
      .notNull()
      .references(() => vehiculos.id),
    asesorId: uuid("asesor_id").references(() => usuarios.id),
    mecanicoId: uuid("mecanico_id").references(() => usuarios.id),
    fechaEntrada: ts("fecha_entrada").notNull().defaultNow(),
    fechaPrevista: date("fecha_prevista"),
    trabajoSolicitado: text("trabajo_solicitado").notNull(),
    datosSiniestro: jsonb("datos_siniestro").$type<DatosSiniestro>(),
    otOrigenId: uuid("ot_origen_id"),
    cerradaEn: ts("cerrada_en"),
    actualizadaEn: ts("actualizada_en").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ot_taller_numero_uq").on(t.tallerId, t.numero),
    index("ot_taller_estado_idx").on(t.tallerId, t.estadoId),
  ],
);

export const historialEstados = pgTable("historial_estados", {
  id: id(),
  tallerId: tallerId(),
  otId: uuid("ot_id")
    .notNull()
    .references(() => ordenesTrabajo.id),
  estadoId: uuid("estado_id")
    .notNull()
    .references(() => estadosFlujo.id),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  comentario: text("comentario"),
  fecha: ts("fecha").notNull().defaultNow(),
});

export type Vista = "superior" | "izquierdo" | "derecho" | "frontal" | "trasera";
/** Daño marcado sobre una vista del vehículo. x/y en % del dibujo (0-100). Sin vista = "superior". */
export type Dano = { x: number; y: number; tipo: string; nota?: string; vista?: Vista };

export const recepciones = pgTable("recepciones", {
  id: id(),
  tallerId: tallerId(),
  otId: uuid("ot_id")
    .notNull()
    .unique()
    .references(() => ordenesTrabajo.id),
  km: integer("km"),
  /** 0..8 (octavos de depósito) */
  combustible: integer("combustible"),
  testigos: jsonb("testigos").$type<string[]>().notNull().default([]),
  objetos: jsonb("objetos").$type<string[]>().notNull().default([]),
  danos: jsonb("danos").$type<Dano[]>().notNull().default([]),
  observaciones: text("observaciones"),
  documentoId: uuid("documento_id"),
});

export const entregas = pgTable("entregas", {
  id: id(),
  tallerId: tallerId(),
  otId: uuid("ot_id")
    .notNull()
    .unique()
    .references(() => ordenesTrabajo.id),
  km: integer("km"),
  trabajosRealizados: text("trabajos_realizados").notNull(),
  piezasSustituidas: text("piezas_sustituidas"),
  garantiaTexto: text("garantia_texto"),
  documentoId: uuid("documento_id"),
  creadoEn: ts("creado_en").notNull().defaultNow(),
});

export const incidencias = pgTable("incidencias", {
  id: id(),
  tallerId: tallerId(),
  otId: uuid("ot_id")
    .notNull()
    .references(() => ordenesTrabajo.id),
  tipo: tipoIncidenciaEnum("tipo").notNull(),
  descripcion: text("descripcion").notNull(),
  estado: estadoIncidenciaEnum("estado").notNull().default("abierta"),
  visibleCliente: boolean("visible_cliente").notNull().default(true),
  afectaPrecio: boolean("afecta_precio").notNull().default(false),
  afectaPlazo: boolean("afecta_plazo").notNull().default(false),
  nuevaFecha: date("nueva_fecha"),
  creadaPor: uuid("creada_por").references(() => usuarios.id),
  resueltaPor: uuid("resuelta_por").references(() => usuarios.id),
  resolucion: text("resolucion"),
  creadaEn: ts("creada_en").notNull().defaultNow(),
  resueltaEn: ts("resuelta_en"),
});

/** Fotos y adjuntos. entidad = "recepcion" | "incidencia" | "ot" | "prestamo" ... */
export const archivos = pgTable(
  "archivos",
  {
    id: id(),
    tallerId: tallerId(),
    otId: uuid("ot_id").references(() => ordenesTrabajo.id),
    entidad: text("entidad").notNull(),
    entidadId: uuid("entidad_id").notNull(),
    ruta: text("ruta").notNull(),
    mime: text("mime").notNull(),
    tamano: integer("tamano").notNull(),
    subidoPor: uuid("subido_por").references(() => usuarios.id),
    creadoEn: ts("creado_en").notNull().defaultNow(),
  },
  (t) => [index("archivos_entidad_idx").on(t.entidad, t.entidadId), index("archivos_ot_idx").on(t.otId)],
);

/** PDF firmados. Inmutables: un cambio genera una versión nueva. */
export const documentos = pgTable("documentos", {
  id: id(),
  tallerId: tallerId(),
  otId: uuid("ot_id").references(() => ordenesTrabajo.id),
  tipo: tipoDocumentoEnum("tipo").notNull(),
  ruta: text("ruta").notNull(),
  sha256: text("sha256").notNull(),
  firmanteNombre: text("firmante_nombre"),
  firmadoEn: ts("firmado_en"),
  firmaIp: text("firma_ip"),
  firmaDispositivo: text("firma_dispositivo"),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  version: integer("version").notNull().default(1),
  creadoEn: ts("creado_en").notNull().defaultNow(),
});

export const cochesSustitucion = pgTable("coches_sustitucion", {
  id: id(),
  tallerId: tallerId(),
  matricula: text("matricula").notNull(),
  marca: text("marca").notNull(),
  modelo: text("modelo").notNull(),
  km: integer("km").notNull().default(0),
  combustible: integer("combustible").notNull().default(8),
  estado: estadoCocheEnum("estado").notNull().default("disponible"),
  itvHasta: date("itv_hasta"),
  seguroHasta: date("seguro_hasta"),
  notas: text("notas"),
  /** Daños actuales conocidos del coche: se precargan al prestarlo y se actualizan con cada devolución */
  danos: jsonb("danos").$type<Dano[]>().notNull().default([]),
  /** false = dado de baja (se conserva por su historial de préstamos) */
  activo: boolean("activo").notNull().default(true),
});

export const prestamos = pgTable("prestamos", {
  id: id(),
  tallerId: tallerId(),
  cocheId: uuid("coche_id")
    .notNull()
    .references(() => cochesSustitucion.id),
  otId: uuid("ot_id").references(() => ordenesTrabajo.id),
  conductorNombre: text("conductor_nombre").notNull(),
  conductorDni: text("conductor_dni").notNull(),
  conductorNacimiento: date("conductor_nacimiento").notNull(),
  carnetFecha: date("carnet_fecha").notNull(),
  condicionesForzadas: boolean("condiciones_forzadas").notNull().default(false),
  pagador: pagadorEnum("pagador").notNull(),
  kmSalida: integer("km_salida").notNull(),
  combSalida: integer("comb_salida").notNull(),
  danosSalida: jsonb("danos_salida").$type<Dano[]>().notNull().default([]),
  kmLlegada: integer("km_llegada"),
  combLlegada: integer("comb_llegada"),
  danosLlegada: jsonb("danos_llegada").$type<Dano[]>(),
  observacionesLlegada: text("observaciones_llegada"),
  docSalidaId: uuid("doc_salida_id"),
  docLlegadaId: uuid("doc_llegada_id"),
  salidaEn: ts("salida_en").notNull().defaultNow(),
  devueltoEn: ts("devuelto_en"),
});

export const citas = pgTable("citas", {
  id: id(),
  tallerId: tallerId(),
  clienteId: uuid("cliente_id").references(() => clientes.id),
  vehiculoId: uuid("vehiculo_id").references(() => vehiculos.id),
  contacto: text("contacto").notNull(),
  telefono: text("telefono"),
  matricula: text("matricula"),
  fechaHora: ts("fecha_hora").notNull(),
  duracionMin: integer("duracion_min").notNull().default(30),
  motivo: text("motivo"),
  tipoOrdenId: uuid("tipo_orden_id").references(() => tiposOrden.id),
  otId: uuid("ot_id").references(() => ordenesTrabajo.id),
});

/** Marcas/modelos creados por el taller que no están en el catálogo base (src/data). modelo null = marca. */
export const catalogoVehiculos = pgTable(
  "catalogo_vehiculos",
  {
    id: id(),
    tallerId: tallerId(),
    marca: text("marca").notNull(),
    modelo: text("modelo"),
    creadoPor: uuid("creado_por").references(() => usuarios.id),
    creadoEn: ts("creado_en").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("catalogo_uq").on(t.tallerId, sql`lower(${t.marca})`, sql`lower(coalesce(${t.modelo}, ''))`)],
);

export const contadores = pgTable(
  "contadores",
  {
    tallerId: tallerId(),
    clave: text("clave").notNull(),
    valor: integer("valor").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tallerId, t.clave] })],
);

export const auditoria = pgTable("auditoria", {
  id: id(),
  tallerId: tallerId(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  entidadId: uuid("entidad_id"),
  datos: jsonb("datos"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  fecha: ts("fecha").notNull().defaultNow(),
});
