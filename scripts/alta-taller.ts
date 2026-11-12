/*
 * Alta de un taller REAL (producción): crea el taller, sus tipos de orden con los flujos base y la primera
 * persona de dirección. No borra nada: si el slug ya existe, se para.
 *
 *   npx tsx scripts/alta-taller.ts --slug valrodri --nombre "Taller Valrodri" --admin "Pablo" --pin 482913
 *
 * Opcionales: --razon "VALRODRI, S.L." --nif B-00000000 --telefono "915 00 00 00" --direccion "..." --email ...
 * El resto (logo, sello, tarifas, horario, empleados, coches de sustitución) se completa en Configuración.
 */
import "./env"; // debe ir primero: carga DATABASE_URL antes de importar la BD

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, t } from "../src/db";
import { FLUJOS_BASE, TEXTOS_LEGALES_BASE } from "../src/lib/flujos-base";

function arg(nombre: string) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1]?.trim() : undefined;
}
function fallo(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function main() {
  const slug = arg("slug")?.toLowerCase();
  const nombre = arg("nombre");
  const admin = arg("admin");
  const pin = arg("pin");
  if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) fallo("--slug obligatorio: minúsculas, números y guiones (es el subdominio: <slug>.tudominio.es)");
  if (!nombre) fallo("--nombre obligatorio (nombre comercial del taller)");
  if (!admin) fallo("--admin obligatorio (nombre de la persona de dirección)");
  if (!pin || !/^\d{6}$/.test(pin)) fallo("--pin obligatorio: 6 cifras (dirección usa PIN de 6)");
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) fallo("PIN demasiado fácil (nada de 111111 ni 123456)");

  if (await db.query.talleres.findFirst({ where: eq(t.talleres.slug, slug) })) fallo(`Ya existe un taller con el slug «${slug}». No se toca nada.`);

  const tid = await db.transaction(async (tx) => {
    const [taller] = await tx
      .insert(t.talleres)
      .values({
        slug,
        nombre,
        razonSocial: arg("razon") ?? null,
        nif: arg("nif") ?? null,
        direccion: arg("direccion") ?? null,
        telefono: arg("telefono") ?? null,
        email: arg("email") ?? null,
        colorPrimario: "#c2410c",
        config: { ...TEXTOS_LEGALES_BASE },
      })
      .returning();

    for (const [i, f] of FLUJOS_BASE.entries()) {
      const [tipo] = await tx
        .insert(t.tiposOrden)
        .values({ tallerId: taller.id, codigo: f.codigo, nombre: f.nombre, color: f.color, orden: i, requiereSiniestro: !!f.siniestro })
        .returning();
      await tx.insert(t.estadosFlujo).values(
        f.estados.map((e, j) => ({
          tallerId: taller.id,
          tipoOrdenId: tipo.id,
          nombre: e.nombre,
          orden: j,
          saltable: !!e.saltable,
          requiereAprobacion: !!e.aprobacion,
          notificaCliente: !!e.notifica,
          marca: e.marca ?? null,
        })),
      );
    }

    await tx.insert(t.usuarios).values({ tallerId: taller.id, nombre: admin, puestos: ["direccion"], color: "#0f172a", pinHash: await bcrypt.hash(pin, 10) });
    return taller.id;
  });

  console.log(`✔ Taller «${nombre}» creado (slug ${slug}, id ${tid}).`);
  console.log(`  Entra en https://${slug}.<tu dominio> con ${admin} y el PIN indicado.`);
  console.log("  Siguiente: Configuración → Datos del taller (logo, sello, horario, tarifas, textos legales), Empleados y Coches de sustitución.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
