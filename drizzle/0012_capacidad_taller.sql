ALTER TABLE "citas" ADD COLUMN "horas" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "necesita_sustitucion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "especialidad" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "horas_dia" numeric(4, 2) DEFAULT '8' NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "dias_trabajo" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL;