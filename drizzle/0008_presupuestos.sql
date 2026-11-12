CREATE TABLE "presupuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"version" integer NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"lineas" jsonb NOT NULL,
	"iva_modo" text NOT NULL,
	"iva_pct" numeric(5, 2) NOT NULL,
	"motivo_exencion" text,
	"precios_con_iva" boolean NOT NULL,
	"base" integer NOT NULL,
	"iva" integer NOT NULL,
	"total" integer NOT NULL,
	"validez_hasta" date NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"decidido_en" timestamp with time zone,
	"decidido_via" text,
	"decidido_nombre" text,
	"decidido_por" uuid,
	"decision_nota" text,
	"decision_ip" text,
	"decision_dispositivo" text,
	"documento_id" uuid
);
--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_decidido_por_usuarios_id_fk" FOREIGN KEY ("decidido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "presupuestos_numero_uq" ON "presupuestos" USING btree ("taller_id","numero");--> statement-breakpoint
CREATE INDEX "presupuestos_ot_idx" ON "presupuestos" USING btree ("taller_id","ot_id");