CREATE TABLE "cobros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"proforma_id" uuid,
	"pagador" text NOT NULL,
	"metodo" text NOT NULL,
	"importe" integer NOT NULL,
	"nota" text,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" uuid,
	"anulado_en" timestamp with time zone,
	"anulado_por" uuid
);
--> statement-breakpoint
CREATE TABLE "proformas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"version" integer NOT NULL,
	"estado" text DEFAULT 'vigente' NOT NULL,
	"lineas" jsonb NOT NULL,
	"iva_modo" text NOT NULL,
	"iva_pct" numeric(5, 2) NOT NULL,
	"motivo_exencion" text,
	"precios_con_iva" boolean NOT NULL,
	"base" integer NOT NULL,
	"iva" integer NOT NULL,
	"total" integer NOT NULL,
	"reparto" jsonb NOT NULL,
	"factura_externa" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_anulado_por_usuarios_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cobros_ot_idx" ON "cobros" USING btree ("taller_id","ot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proformas_numero_uq" ON "proformas" USING btree ("taller_id","numero");--> statement-breakpoint
CREATE INDEX "proformas_ot_idx" ON "proformas" USING btree ("taller_id","ot_id");