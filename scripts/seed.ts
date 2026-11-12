/* Datos de DEMO ficticios. Uso: npm run db:seed  (borra y recrea el taller "valrodri") */
import "./env"; // debe ir primero: carga DATABASE_URL antes de importar la BD

import bcrypt from "bcryptjs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, t } from "../src/db";
import { FLUJOS_BASE, TEXTOS_LEGALES_BASE } from "../src/lib/flujos-base";

const SLUG = process.env.DEFAULT_TALLER_SLUG ?? "valrodri";

async function borrarTaller(tallerId: string) {
  const tablas = [
    t.auditoria, t.catalogoVehiculos, t.citas, t.prestamos, t.cochesSustitucion, t.documentos, t.archivos, t.incidencias,
    t.entregas, t.recepciones, t.historialEstados, t.ordenesTrabajo, t.estadosFlujo, t.tiposOrden,
    t.vehiculos, t.clientes, t.usuarios, t.contadores,
  ] as const;
  for (const tabla of tablas) await db.delete(tabla).where(eq(tabla.tallerId, tallerId));
  await db.delete(t.talleres).where(eq(t.talleres.id, tallerId));
}

const diasDesdeHoy = (n: number, h = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, 0, 0, 0);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const previo = await db.query.talleres.findFirst({ where: eq(t.talleres.slug, SLUG) });
  // Protección: este script BORRA el taller. Solo se permite sobre un taller de demo creado por él mismo.
  if (previo && !previo.config?.demo && process.env.SEED_FORZAR !== "1") {
    console.error(`✖ El taller «${SLUG}» no es de demo (tiene datos reales). No se borra nada.`);
    console.error("  Para la demo usa otro slug: DEFAULT_TALLER_SLUG=demo npm run db:seed");
    console.error("  (Si es una demo antigua creada antes de esta protección: SEED_FORZAR=1 npm run db:seed)");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORZAR !== "1") {
    console.error("✖ NODE_ENV=production: el seed de demo está bloqueado (SEED_FORZAR=1 para un servidor de demo).");
    process.exit(1);
  }
  if (previo) {
    await borrarTaller(previo.id);
    // Fotos y PDF del taller anterior
    await rm(path.resolve(process.env.STORAGE_DIR ?? "./storage", previo.id), { recursive: true, force: true });
  }

  const [taller] = await db
    .insert(t.talleres)
    .values({
      slug: SLUG,
      nombre: "Taller Valrodri",
      razonSocial: "VALRODRI, S.L.",
      nif: "B-78630282",
      direccion: "C/ Cerámica 82-84, Patio 7 · Pol. Ind. La Cerámica · 28038 Madrid",
      telefono: "915 01 15 84",
      whatsapp: "680 77 29 49",
      email: "talleresvalrodri@hotmail.com",
      colorPrimario: "#c2410c",
      config: { ...TEXTOS_LEGALES_BASE, demo: true, horario: "L-V 8:30-14:00 y 15:00-18:00" },
    })
    .returning();
  const tid = taller.id;

  // Usuarios (PIN entre paréntesis — solo demo)
  const usuariosDef = [
    { nombre: "Pablo", rol: "admin", pin: "123456", color: "#0f172a" },
    { nombre: "Laura", rol: "asesor", pin: "1111", color: "#c2410c" },
    { nombre: "Javier", rol: "jefe_taller", pin: "222222", color: "#1d4ed8" },
    { nombre: "Rubén", rol: "mecanico", pin: "3333", color: "#15803d" },
    { nombre: "Sergio", rol: "mecanico", pin: "4444", color: "#7c3aed" },
    { nombre: "Iván (chapa)", rol: "mecanico", pin: "5555", color: "#b45309" },
    { nombre: "Marta (pintura)", rol: "mecanico", pin: "6666", color: "#db2777" },
  ] as const;
  const usuarios = await db
    .insert(t.usuarios)
    .values(
      await Promise.all(
        usuariosDef.map(async (u) => ({
          tallerId: tid,
          nombre: u.nombre,
          rol: u.rol,
          color: u.color,
          pinHash: await bcrypt.hash(u.pin, 10),
        })),
      ),
    )
    .returning();
  const U = Object.fromEntries(usuarios.map((u) => [u.nombre.split(" ")[0], u]));

  // Tipos de orden + estados
  const tipos: Record<string, { id: string; estados: { id: string; nombre: string }[] }> = {};
  for (const [i, f] of FLUJOS_BASE.entries()) {
    const [tipo] = await db
      .insert(t.tiposOrden)
      .values({ tallerId: tid, codigo: f.codigo, nombre: f.nombre, color: f.color, orden: i, requiereSiniestro: !!f.siniestro })
      .returning();
    const estados = await db
      .insert(t.estadosFlujo)
      .values(
        f.estados.map((e, j) => ({
          tallerId: tid,
          tipoOrdenId: tipo.id,
          nombre: e.nombre,
          orden: j,
          saltable: !!e.saltable,
          requiereAprobacion: !!e.aprobacion,
          notificaCliente: !!e.notifica,
          marca: e.marca ?? null,
        })),
      )
      .returning();
    tipos[f.codigo] = { id: tipo.id, estados };
  }
  const estado = (codigo: string, nombre: string) => tipos[codigo].estados.find((e) => e.nombre === nombre)!;

  // Compañías (aseguradoras / renting)
  const [mutua, bansacar, otraAseg] = await db
    .insert(t.clientes)
    .values([
      { tallerId: tid, tipo: "aseguradora", nombre: "Mutua Madrileña", nif: "V-28027118" },
      { tallerId: tid, tipo: "flota", nombre: "Bansacar (Santander Renting)" },
      { tallerId: tid, tipo: "aseguradora", nombre: "Aseguradora Ejemplo" },
    ])
    .returning();

  // Clientes ficticios
  const clientesDef = [
    { nombre: "María López García", nif: "12345678Z", telefono: "600111222", email: "maria.demo@example.com", veh: ["1234 KLM", "Seat", "León", 2019, "Diésel", "Gris", 87540] },
    { nombre: "Antonio Ruiz Pérez", nif: "23456789D", telefono: "600222333", email: null, veh: ["5678 JHG", "Volkswagen", "Golf", 2016, "Gasolina", "Blanco", 132200] },
    { nombre: "Lucía Fernández", nif: "34567890V", telefono: "600333444", email: "lucia.demo@example.com", veh: ["9012 LBC", "Toyota", "C-HR Hybrid", 2021, "Híbrido", "Rojo", 41230] },
    { nombre: "Reformas Hermanos Gil S.L.", nif: "B12345674", telefono: "600444555", email: "admin.demo@example.com", tipo: "empresa", veh: ["3456 MDF", "Renault", "Kangoo", 2020, "Diésel", "Blanco", 98760] },
    { nombre: "Carlos Martín Sanz", nif: "45678901G", telefono: "600555666", email: "carlos.demo@example.com", veh: ["7890 KZX", "Peugeot", "3008", 2018, "Diésel", "Negro", 110300] },
    { nombre: "Elena Navarro", nif: "56789012B", telefono: "600666777", email: null, veh: ["2468 LGH", "Kia", "Sportage", 2022, "Gasolina", "Azul", 28900] },
    { nombre: "Fundación Ejemplo (exenta)", nif: "G12345678", telefono: "600777888", email: "fundacion.demo@example.com", tipo: "empresa", exento: true, veh: ["1357 LPR", "Dacia", "Duster", 2020, "Gasolina", "Verde", 64300] },
  ] as const;

  const vehs: Record<string, { clienteId: string; vehiculoId: string }> = {};
  for (const c of clientesDef) {
    const [cli] = await db
      .insert(t.clientes)
      .values({
        tallerId: tid,
        tipo: ("tipo" in c ? c.tipo : "particular") as "particular" | "empresa",
        nombre: c.nombre,
        nif: c.nif,
        telefono: c.telefono,
        email: c.email,
        aceptaEmail: !!c.email,
        aceptaWhatsapp: true,
        exentoIva: "exento" in c,
        motivoExencion: "exento" in c ? "Art. 20.Uno.12º Ley 37/1992 (ejemplo)" : null,
      })
      .returning();
    const [m, marca, modelo, anio, comb, color, km] = c.veh;
    const [v] = await db
      .insert(t.vehiculos)
      .values({ tallerId: tid, clienteId: cli.id, matricula: m, marca, modelo, anio, combustible: comb, color, kmUltimo: km })
      .returning();
    vehs[m] = { clienteId: cli.id, vehiculoId: v.id };
  }

  // Órdenes de trabajo en distintos estados
  type OtDef = {
    m: string; tipo: string; recorrido: string[]; trabajo: string; mecanico?: string; diasAtras: number;
    prevista?: number; siniestro?: object; danos?: { x: number; y: number; tipo: string }[];
  };
  const ots: OtDef[] = [
    { m: "1234 KLM", tipo: "siniestro", recorrido: ["Recepcionado", "Pendiente de peritaje", "Peritado", "Chapa"], trabajo: "Golpe en aleta delantera izquierda y paragolpes. Siniestro Mutua.", mecanico: "Iván", diasAtras: 4, prevista: 3,
      siniestro: { companiaId: mutua.id, companiaNombre: mutua.nombre, numeroSiniestro: "MM-2026-884512", numeroPoliza: "PZ-55120", perito: "D. Ramírez (perito Mutua)", franquicia: 150, cubreSustitucion: true },
      danos: [{ x: 22, y: 18, tipo: "Abolladura" }, { x: 50, y: 6, tipo: "Rotura" }] },
    { m: "9012 LBC", tipo: "siniestro", recorrido: ["Recepcionado", "Pendiente de peritaje"], trabajo: "Rayada lateral derecha (puertas). Pendiente de perito.", diasAtras: 1, prevista: 6,
      siniestro: { companiaId: mutua.id, companiaNombre: mutua.nombre, numeroSiniestro: "MM-2026-901277", perito: "", franquicia: 0, cubreSustitucion: false },
      danos: [{ x: 80, y: 45, tipo: "Arañazo" }, { x: 80, y: 60, tipo: "Arañazo" }] },
    { m: "5678 JHG", tipo: "averia", recorrido: ["Recepcionado", "En diagnóstico", "Pendiente de aprobación"], trabajo: "Ruido al frenar y testigo de motor encendido.", mecanico: "Rubén", diasAtras: 2, prevista: 2 },
    { m: "3456 MDF", tipo: "renting", recorrido: ["Recepcionado", "Pendiente de autorización", "Esperando piezas"], trabajo: "Sustitución embrague. Vehículo de renting.", mecanico: "Sergio", diasAtras: 3, prevista: 4,
      siniestro: { companiaId: bansacar.id, companiaNombre: bansacar.nombre, numeroSiniestro: "AUT-77812", numeroPoliza: "CTR-2020-1188" } },
    { m: "7890 KZX", tipo: "mantenimiento", recorrido: ["Recepcionado", "En reparación"], trabajo: "Revisión 110.000 km: aceite, filtros y kit de distribución.", mecanico: "Rubén", diasAtras: 0, prevista: 1 },
    { m: "2468 LGH", tipo: "neumaticos", recorrido: ["Recepcionado", "En montaje", "Listo para entregar"], trabajo: "Cambio de 4 neumáticos y alineado.", mecanico: "Sergio", diasAtras: 0, prevista: 0 },
    { m: "1357 LPR", tipo: "lunas", recorrido: ["Recepcionado", "Esperando luna"], trabajo: "Sustitución parabrisas por impacto.", diasAtras: 1, prevista: 2,
      danos: [{ x: 50, y: 27, tipo: "Rotura" }] },
  ];

  let n = 0;
  for (const o of ots) {
    n++;
    const entrada = diasDesdeHoy(-o.diasAtras, 9);
    const actual = estado(o.tipo, o.recorrido.at(-1)!);
    const v = vehs[o.m];
    const [ot] = await db
      .insert(t.ordenesTrabajo)
      .values({
        tallerId: tid,
        numero: `${new Date().getFullYear()}-${String(n).padStart(4, "0")}`,
        tipoOrdenId: tipos[o.tipo].id,
        estadoId: actual.id,
        clienteId: v.clienteId,
        vehiculoId: v.vehiculoId,
        asesorId: U["Laura"].id,
        mecanicoId: o.mecanico ? U[o.mecanico].id : null,
        fechaEntrada: entrada,
        fechaPrevista: o.prevista != null ? iso(diasDesdeHoy(o.prevista)) : null,
        trabajoSolicitado: o.trabajo,
        datosSiniestro: o.siniestro ?? null,
      })
      .returning();
    await db.insert(t.historialEstados).values(
      o.recorrido.map((nombre, i) => ({
        tallerId: tid,
        otId: ot.id,
        estadoId: estado(o.tipo, nombre).id,
        usuarioId: i === 0 ? U["Laura"].id : U["Javier"].id,
        fecha: new Date(entrada.getTime() + i * 3 * 3600_000),
      })),
    );
    const vRow = await db.query.vehiculos.findFirst({ where: eq(t.vehiculos.id, v.vehiculoId) });
    await db.insert(t.recepciones).values({
      tallerId: tid,
      otId: ot.id,
      km: vRow?.kmUltimo ?? 0,
      combustible: 4,
      testigos: o.tipo === "averia" ? ["Motor"] : [],
      objetos: ["Llaves (2)", "Documentación"],
      danos: o.danos ?? [],
    });
    if (o.recorrido.includes("Esperando piezas")) {
      await db.insert(t.incidencias).values({
        tallerId: tid, otId: ot.id, tipo: "retraso_piezas", afectaPlazo: true,
        descripcion: "Proveedor retrasa el kit de embrague 48 h.", nuevaFecha: iso(diasDesdeHoy(4)), creadaPor: U["Sergio"].id,
      });
    }
    if (o.tipo === "averia") {
      await db.insert(t.incidencias).values({
        tallerId: tid, otId: ot.id, tipo: "averia_adicional", afectaPrecio: true,
        descripcion: "Discos delanteros por debajo del mínimo; además fuga en latiguillo trasero.", creadaPor: U["Rubén"].id,
      });
    }
  }
  await db.insert(t.contadores).values({ tallerId: tid, clave: `ot-${new Date().getFullYear()}`, valor: n });

  // Coches de sustitución
  await db.insert(t.cochesSustitucion).values([
    { tallerId: tid, matricula: "4321 LKJ", marca: "Seat", modelo: "Ibiza", km: 45210, itvHasta: iso(diasDesdeHoy(300)), seguroHasta: iso(diasDesdeHoy(200)) },
    { tallerId: tid, matricula: "8765 LMN", marca: "Dacia", modelo: "Sandero", km: 23890, itvHasta: iso(diasDesdeHoy(500)), seguroHasta: iso(diasDesdeHoy(200)) },
  ]);

  // Citas de hoy y mañana
  await db.insert(t.citas).values([
    { tallerId: tid, contacto: "Jorge Blanco", telefono: "600888999", matricula: "6543 KTR", fechaHora: diasDesdeHoy(0, 10), motivo: "Revisión anual", tipoOrdenId: tipos["mantenimiento"].id },
    { tallerId: tid, contacto: "Sara Ortega", telefono: "600999000", matricula: "1122 LDS", fechaHora: diasDesdeHoy(0, 12), motivo: "Parte Mutua – golpe trasero", tipoOrdenId: tipos["siniestro"].id },
    { tallerId: tid, contacto: "Pedro Gómez", telefono: "600123123", matricula: "9988 JKL", fechaHora: diasDesdeHoy(1, 9), motivo: "Ruido suspensión", tipoOrdenId: tipos["averia"].id },
  ]);

  void inArray; void otraAseg;
  console.log(`✔ Taller demo "${taller.nombre}" (${SLUG}) creado con ${ots.length} órdenes.`);
  console.log("  PINs: Pablo 123456 · Laura 1111 · Javier 222222 · Rubén 3333 · Sergio 4444 · Iván 5555 · Marta 6666");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
