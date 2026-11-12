# Gestión de Taller

App web (PWA) para gestionar un taller de principio a fin: **recepción con firma → trabajo en taller → incidencias → entrega con firma**, más **coches de sustitución**. Es multi-taller: cada taller tiene sus datos separados y entra por su propio subdominio.

Especificación funcional: [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md) · Despliegue: [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)

## Tecnología

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · PostgreSQL + Drizzle ORM · `signature_pad` · `@react-pdf/renderer` · sesión JWT (jose) con PIN.

## Arrancar en local

Requisitos: Node ≥ 20.18 y PostgreSQL (local o `docker compose up -d`).

```bash
npm install
cp .env.example .env.local        # y ajusta DATABASE_URL / SESSION_SECRET
npm run db:migrate                # crea las tablas
npm run db:seed                   # datos de DEMO ficticios (borra y recrea el taller demo)
npm run dev                       # http://localhost:3000
```

Para probarlo en una tablet o un móvil de la misma red Wi-Fi, abre `http://<IP-del-Mac>:3000`. Para usar la cámara desde el navegador hace falta HTTPS, salvo en `localhost`; en el servidor ya lo tendrá.

### Usuarios de la demo (PIN)

Cada persona puede tener **varios puestos**; su pantalla de inicio junta lo de todos.

| Usuario | Puestos | PIN |
|---|---|---|
| Pablo | Dirección (ve todo y configura) | 1234 |
| Laura | Recepción + Atención al cliente | 1111 |
| Carmen | Facturación + Atención al cliente | 7777 |
| Javier | Jefe de taller | 2222 |
| Rubén / Sergio | Mecánicos | 3333 / 4444 |
| Iván (chapa) / Marta (pintura) | Mecánicos | 5555 / 6666 |

## Guion para la demo (≈10 min)

1. **Inicio (Laura, tablet).** Vehículos en taller, listos para entregar, pendientes de perito y citas del día.
2. **Recibir la cita de las 12:00** (golpe trasero, parte de Mutua) → asistente de 5 pasos: matrícula → tipo «Siniestro aseguradora» con nº de siniestro y franquicia → km, combustible y testigos → **tocar la silueta para marcar los daños** → fotos con la cámara → **el cliente firma en la tablet**. Se genera el **resguardo en PDF** con fotos, daños y firma.
3. **Coche de sustitución.** Desde la orden: comprueba la edad y la antigüedad del carnet, se marcan los daños del coche y firma el conductor.
4. **Tablero** por tipo de orden: ver el siniestro avanzar (Peritaje → Chapa → Pintura → Montaje…).
5. **Móvil del mecánico (Iván).** «Mis trabajos» → «Terminado → siguiente paso» → abre una **incidencia con foto** (p. ej., retraso de piezas, que cambia la fecha prevista).
6. **Listo → aviso por WhatsApp** con el mensaje ya escrito.
7. **Entrega.** Si el coche de sustitución no se ha devuelto, la app no deja entregar. Primero la devolución (km, combustible y daños nuevos), luego el acta de entrega firmada.
8. **Documentos.** Cada PDF lleva su huella **SHA-256**; si alguien modificara el fichero, la app lo detectaría.

## Estructura

```
src/
  app/(app)/          pantallas con sesión (inicio, tablero, recepción, OT, entrega, sustitución, mis-trabajos)
  app/login/          acceso por usuario + PIN
  app/api/            servir fotos y PDF (con control de taller y de integridad)
  components/         UI, silueta de daños, firma, cámara, combustible
  db/schema.ts        modelo de datos (taller_id en todas las tablas)
  lib/                sesión, multi-taller, datos, PDF, almacenamiento, auditoría
scripts/              seed de demo, migraciones en producción, backup
drizzle/              migraciones SQL versionadas
```

## Estado

**Hecho (demo):** acceso con PIN · **puestos combinables** (dirección, recepción, atención al cliente, facturación, jefe de taller, mecánico) con inicio adaptado a cada uno · **buscador global** con «qué decirle al cliente» · **configuración**: empleados, coches de sustitución, datos del taller, logo y textos legales · recepción en 5 pasos con daños, fotos y firma → PDF · flujos configurables por tipo de orden (7 tipos) · tablero · asignación de mecánicos · vista móvil del mecánico · incidencias con fotos · coches de sustitución (préstamo y devolución firmados, comprobación de condiciones) · entrega con firma · historial y auditoría · avisos por WhatsApp con enlace.

**Pendiente para el MVP:** presupuestos (firma en tablet y aprobación por enlace) · proforma, IVA/exento y reparto entre cliente y aseguradora · cobros · avisos por email · agenda (crear y editar citas) · importación de Excel · exportación para el programa de facturación · ZIP de fotos para la fotoperitación · configuración de tipos de orden y flujos desde la app · Row Level Security en PostgreSQL · probar la imagen Docker en el VPS.
