CREATE TYPE "public"."estado_coche" AS ENUM('disponible', 'prestado', 'mantenimiento');--> statement-breakpoint
CREATE TYPE "public"."estado_incidencia" AS ENUM('abierta', 'en_curso', 'resuelta', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."pagador" AS ENUM('aseguradora', 'cortesia', 'cliente');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'asesor', 'jefe_taller', 'mecanico');--> statement-breakpoint
CREATE TYPE "public"."tipo_cliente" AS ENUM('particular', 'empresa', 'aseguradora', 'flota');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('resguardo', 'presupuesto', 'entrega', 'proforma', 'prestamo_salida', 'prestamo_devolucion');--> statement-breakpoint
CREATE TYPE "public"."tipo_incidencia" AS ENUM('averia_adicional', 'retraso_piezas', 'dano_taller', 'reclamacion');--> statement-breakpoint
CREATE TABLE "archivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid,
	"entidad" text NOT NULL,
	"entidad_id" uuid NOT NULL,
	"ruta" text NOT NULL,
	"mime" text NOT NULL,
	"tamano" integer NOT NULL,
	"subido_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"usuario_id" uuid,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" uuid,
	"datos" jsonb,
	"ip" text,
	"user_agent" text,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"cliente_id" uuid,
	"vehiculo_id" uuid,
	"contacto" text NOT NULL,
	"telefono" text,
	"matricula" text,
	"fecha_hora" timestamp with time zone NOT NULL,
	"duracion_min" integer DEFAULT 30 NOT NULL,
	"motivo" text,
	"tipo_orden_id" uuid,
	"ot_id" uuid
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"tipo" "tipo_cliente" DEFAULT 'particular' NOT NULL,
	"nombre" text NOT NULL,
	"nif" text,
	"telefono" text,
	"email" text,
	"direccion" text,
	"exento_iva" boolean DEFAULT false NOT NULL,
	"motivo_exencion" text,
	"acepta_whatsapp" boolean DEFAULT false NOT NULL,
	"acepta_email" boolean DEFAULT false NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coches_sustitucion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"matricula" text NOT NULL,
	"marca" text NOT NULL,
	"modelo" text NOT NULL,
	"km" integer DEFAULT 0 NOT NULL,
	"combustible" integer DEFAULT 8 NOT NULL,
	"estado" "estado_coche" DEFAULT 'disponible' NOT NULL,
	"itv_hasta" date,
	"seguro_hasta" date,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "contadores" (
	"taller_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"valor" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contadores_taller_id_clave_pk" PRIMARY KEY("taller_id","clave")
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid,
	"tipo" "tipo_documento" NOT NULL,
	"ruta" text NOT NULL,
	"sha256" text NOT NULL,
	"firmante_nombre" text,
	"firmado_en" timestamp with time zone,
	"firma_ip" text,
	"firma_dispositivo" text,
	"usuario_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entregas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"km" integer,
	"trabajos_realizados" text NOT NULL,
	"piezas_sustituidas" text,
	"garantia_texto" text,
	"documento_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entregas_ot_id_unique" UNIQUE("ot_id")
);
--> statement-breakpoint
CREATE TABLE "estados_flujo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"tipo_orden_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer NOT NULL,
	"saltable" boolean DEFAULT false NOT NULL,
	"requiere_aprobacion" boolean DEFAULT false NOT NULL,
	"notifica_cliente" boolean DEFAULT false NOT NULL,
	"marca" text
);
--> statement-breakpoint
CREATE TABLE "historial_estados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"estado_id" uuid NOT NULL,
	"usuario_id" uuid,
	"comentario" text,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"tipo" "tipo_incidencia" NOT NULL,
	"descripcion" text NOT NULL,
	"estado" "estado_incidencia" DEFAULT 'abierta' NOT NULL,
	"visible_cliente" boolean DEFAULT true NOT NULL,
	"afecta_precio" boolean DEFAULT false NOT NULL,
	"afecta_plazo" boolean DEFAULT false NOT NULL,
	"nueva_fecha" date,
	"creada_por" uuid,
	"resuelta_por" uuid,
	"resolucion" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"resuelta_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ordenes_trabajo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"tipo_orden_id" uuid NOT NULL,
	"estado_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"vehiculo_id" uuid NOT NULL,
	"asesor_id" uuid,
	"mecanico_id" uuid,
	"fecha_entrada" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_prevista" date,
	"trabajo_solicitado" text NOT NULL,
	"datos_siniestro" jsonb,
	"ot_origen_id" uuid,
	"cerrada_en" timestamp with time zone,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestamos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"coche_id" uuid NOT NULL,
	"ot_id" uuid,
	"conductor_nombre" text NOT NULL,
	"conductor_dni" text NOT NULL,
	"conductor_nacimiento" date NOT NULL,
	"carnet_fecha" date NOT NULL,
	"condiciones_forzadas" boolean DEFAULT false NOT NULL,
	"pagador" "pagador" NOT NULL,
	"km_salida" integer NOT NULL,
	"comb_salida" integer NOT NULL,
	"danos_salida" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"km_llegada" integer,
	"comb_llegada" integer,
	"danos_llegada" jsonb,
	"observaciones_llegada" text,
	"doc_salida_id" uuid,
	"doc_llegada_id" uuid,
	"salida_en" timestamp with time zone DEFAULT now() NOT NULL,
	"devuelto_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recepciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"km" integer,
	"combustible" integer,
	"testigos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objetos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"danos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observaciones" text,
	"documento_id" uuid,
	CONSTRAINT "recepciones_ot_id_unique" UNIQUE("ot_id")
);
--> statement-breakpoint
CREATE TABLE "talleres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"razon_social" text,
	"nif" text,
	"direccion" text,
	"telefono" text,
	"whatsapp" text,
	"email" text,
	"logo_ruta" text,
	"color_primario" text DEFAULT '#1d4ed8' NOT NULL,
	"iva_defecto" numeric DEFAULT '21' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talleres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tipos_orden" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"requiere_siniestro" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"email" text,
	"password_hash" text,
	"pin_hash" text NOT NULL,
	"rol" "rol" NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"cliente_id" uuid,
	"matricula" text NOT NULL,
	"bastidor" text,
	"marca" text,
	"modelo" text,
	"anio" integer,
	"combustible" text,
	"color" text,
	"km_ultimo" integer
);
--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_subido_por_usuarios_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_tipo_orden_id_tipos_orden_id_fk" FOREIGN KEY ("tipo_orden_id") REFERENCES "public"."tipos_orden"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coches_sustitucion" ADD CONSTRAINT "coches_sustitucion_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contadores" ADD CONSTRAINT "contadores_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estados_flujo" ADD CONSTRAINT "estados_flujo_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estados_flujo" ADD CONSTRAINT "estados_flujo_tipo_orden_id_tipos_orden_id_fk" FOREIGN KEY ("tipo_orden_id") REFERENCES "public"."tipos_orden"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_estado_id_estados_flujo_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."estados_flujo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_creada_por_usuarios_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_resuelta_por_usuarios_id_fk" FOREIGN KEY ("resuelta_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_tipo_orden_id_tipos_orden_id_fk" FOREIGN KEY ("tipo_orden_id") REFERENCES "public"."tipos_orden"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_estado_id_estados_flujo_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."estados_flujo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_asesor_id_usuarios_id_fk" FOREIGN KEY ("asesor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_mecanico_id_usuarios_id_fk" FOREIGN KEY ("mecanico_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_coche_id_coches_sustitucion_id_fk" FOREIGN KEY ("coche_id") REFERENCES "public"."coches_sustitucion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_orden" ADD CONSTRAINT "tipos_orden_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archivos_entidad_idx" ON "archivos" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "archivos_ot_idx" ON "archivos" USING btree ("ot_id");--> statement-breakpoint
CREATE INDEX "clientes_taller_idx" ON "clientes" USING btree ("taller_id");--> statement-breakpoint
CREATE INDEX "estados_tipo_idx" ON "estados_flujo" USING btree ("tipo_orden_id","orden");--> statement-breakpoint
CREATE UNIQUE INDEX "ot_taller_numero_uq" ON "ordenes_trabajo" USING btree ("taller_id","numero");--> statement-breakpoint
CREATE INDEX "ot_taller_estado_idx" ON "ordenes_trabajo" USING btree ("taller_id","estado_id");--> statement-breakpoint
CREATE INDEX "usuarios_taller_idx" ON "usuarios" USING btree ("taller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehiculos_taller_matricula_uq" ON "vehiculos" USING btree ("taller_id","matricula");