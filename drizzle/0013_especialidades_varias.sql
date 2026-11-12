ALTER TABLE "usuarios" ADD COLUMN "especialidades" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "usuarios" SET "especialidades" = ARRAY["especialidad"] WHERE "especialidad" IS NOT NULL;
