ALTER TABLE "coches_sustitucion" ADD COLUMN "danos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coches_sustitucion" ADD COLUMN "activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "talleres" ADD COLUMN "sello_ruta" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "puestos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Copia los roles antiguos a puestos (el asesor hacía recepción, llamadas y cobros)
UPDATE "usuarios" SET "puestos" = CASE "rol"
  WHEN 'admin' THEN ARRAY['direccion']::text[]
  WHEN 'asesor' THEN ARRAY['recepcion','telefono','facturacion']::text[]
  WHEN 'jefe_taller' THEN ARRAY['jefe_taller']::text[]
  ELSE ARRAY['mecanico']::text[]
END;
