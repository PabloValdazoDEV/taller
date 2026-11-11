CREATE TABLE "catalogo_vehiculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taller_id" uuid NOT NULL,
	"marca" text NOT NULL,
	"modelo" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalogo_vehiculos" ADD CONSTRAINT "catalogo_vehiculos_taller_id_talleres_id_fk" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogo_vehiculos" ADD CONSTRAINT "catalogo_vehiculos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalogo_uq" ON "catalogo_vehiculos" USING btree ("taller_id",lower("marca"),lower(coalesce("modelo", '')));