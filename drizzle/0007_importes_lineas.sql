CREATE TABLE "lineas_ot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"ot_id" uuid NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"tipo" text NOT NULL,
	"especialidad" text,
	"referencia" text,
	"descripcion" text NOT NULL,
	"cantidad" numeric(10, 2) NOT NULL,
	"precio" numeric(12, 4) NOT NULL,
	"descuento" numeric(5, 2) DEFAULT '0' NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "iva_modo" text;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "iva_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "motivo_exencion" text;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "precios_con_iva" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lineas_ot" ADD CONSTRAINT "lineas_ot_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_ot" ADD CONSTRAINT "lineas_ot_ot_id_ordenes_trabajo_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_ot" ADD CONSTRAINT "lineas_ot_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lineas_ot_idx" ON "lineas_ot" USING btree ("taller_id","ot_id");