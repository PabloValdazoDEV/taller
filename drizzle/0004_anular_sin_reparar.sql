ALTER TABLE "entregas" ADD COLUMN "motivo_sin_reparar" text;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "anulada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD COLUMN "motivo_anulacion" text;