ALTER TABLE "citas" ADD COLUMN "franja" text;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "nota" text;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "estado" text DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "creado_por" uuid;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "creado_en" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;