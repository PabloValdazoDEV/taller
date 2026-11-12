ALTER TABLE "presupuestos" ADD COLUMN "amplia_id" uuid;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD COLUMN "horas_estimadas" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "presupuestos" ADD COLUMN "fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "proformas" ADD COLUMN "conformidad_exceso" text;