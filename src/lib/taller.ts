import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { slugDesdeHost } from "./tenant";

export const tallerActual = cache(async () => {
  const slug = slugDesdeHost((await headers()).get("host"));
  const taller = await db.query.talleres.findFirst({ where: eq(t.talleres.slug, slug) });
  return taller ?? null;
});

export const tallerPorId = cache(async (id: string) => {
  const taller = await db.query.talleres.findFirst({ where: eq(t.talleres.id, id) });
  if (!taller) throw new Error("Taller no encontrado");
  return taller;
});
