# Contexto para Claude

App de gestión integral de taller (recepción con firma → trabajo → incidencias → entrega), multi-taller para revender.
Spec completa: `docs/ESPECIFICACION.md`. Despliegue: `docs/DESPLIEGUE.md`. Cómo arrancar y estado: `README.md`.
Preparación de la visita comercial a Valrodri (qué llevar, guion de demo, preguntas): `docs/VISITA-VALRODRI.md`.

## Cómo trabajar con el usuario
- Pregúntale ante cualquier decisión con dudas en vez de decidir solo. Habla en español.
- No hagas commit/push salvo que lo pida. Nunca subas `.env.local`.
- Facturación siempre legal (con factura); no ayudar a cobrar "en negro".

## Decisiones acordadas
- Stack: Next.js 15 (App Router, Server Actions) + TypeScript + Tailwind 4 + PostgreSQL + Drizzle. Hosting en VPS propio (Ubuntu + Plesk, Arsys) con Docker Compose; nada de Vercel/Supabase.
- Multi-tenant: `taller_id` en todas las tablas, taller por subdominio (`DEFAULT_TALLER_SLUG` en local). RLS pendiente.
- Login por PIN (JWT con jose). **Puestos combinables** (una persona puede tener varios; su inicio y permisos son la suma): direccion, recepcion, telefono (atención al cliente), facturacion, jefe_taller, mecanico. Permisos en `src/lib/puestos.ts`.
- Dispositivos: PC oficina, tablet recepción (firma/fotos), móvil mecánicos. Pantalla TV aplazada.
- Firma manuscrita en tablet → PDF inmutable con hash SHA-256. Envío por WhatsApp (Web Share + enlace firmado `/d/<token>`).
- Flujos configurables por tipo de orden (mantenimiento, avería, siniestro aseguradora, renting, lunas, neumáticos, garantía).
- Incidencias: avería adicional, retraso piezas, daño en taller, reclamación.
- Presupuesto: casilla por orden «El cliente debe aceptar el presupuesto antes de empezar» (valor por defecto según tipo de orden: no en mantenimiento/lunas/neumáticos, sí en averías). Si está activa, la orden se bloquea en «Pendiente de aprobación» hasta que firma en tablet o aprueba por enlace. Si no, el resguardo recoge la renuncia a presupuesto previo (RD 1457/1986). En siniestros aprueba la aseguradora/perito. Las averías adicionales siempre requieren aprobación.
- IVA: dos modos por trabajo: **con IVA** (base + IVA desglosado + total) o **exento** (subtotal sin IVA + mención del motivo legal de la exención). Nunca "sin IVA" fuera de una exención real.
- Facturación: proforma en la app; factura legal en programa externo con Verifactu. Cobros: efectivo, tarjeta, aseguradora/flota (pago dividido).
- Enlace de seguimiento para el cliente: se envía **en la recepción** junto al resguardo firmado; muestra estado (en lenguaje de cliente, `src/lib/estado-cliente.ts`), fecha prevista, documentos y la aprobación del presupuesto; al entregar muestra el acta y la garantía.
- Diseño: colores del logo de Valrodri = rojo #E3061B + carbón. El rojo solo como acento de marca (no en botones principales: se confunde con error/peligro); acciones en carbón; estados con colores genéricos.
- Avisos: email/teléfono primero; WhatsApp/SMS más adelante.
- Stock, fichaje y pedidos: "en la recámara", no es lo principal.
- Importación de Excel: formato aún desconocido → importador con mapeo de columnas flexible.

## Contexto comercial
- Propuesta PROACTIVA a Taller Valrodri (VALRODRI S.L., Vallecas, https://tallercochesvallecas.es/): concertado Mutua Madrileña y Bansacar, perito diario, coches de sustitución. Aún no han contactado; pruebas internas con datos ficticios.
- Antes de ir: ver `docs/VISITA-VALRODRI.md` (Pablo pedirá ayuda para prepararla).
- Pendiente de ellos: Excel de ejemplo, datos/textos legales, aseguradoras, nº coches sustitución, programa de facturación, dominio y SMTP, sello del taller escaneado.

## Estado
- Hecho (demo probada E2E): recepción 5 pasos + firma + PDF, tablero, OT, incidencias, móvil mecánico, coche sustitución, entrega con fotos antes/después, selector marca/modelo con logos, daños en 5 vistas, barra lateral plegable, envío por WhatsApp, sección Clientes.
- Hecho (bloque 1): puestos combinables + inicio por puesto, buscador global con «qué decirle», Configuración (empleados, coches de sustitución, datos del taller/logo/horario/textos legales).
- Sello/firma del taller (Configuración › Datos del taller, PNG/JPG, privado vía `/api/sello`) estampado en «Por el taller» de todos los PDF; el logo sale en su cabecera.
- Recepción: desde «Revisión y firma» cada bloque tiene «Cambiar» y luego «Volver a la firma»; al volver atrás se conservan las fotos y la firma se anula (el cliente firma los datos finales).
- Coches de sustitución con daños persistentes en su ficha: se precargan al prestar y los nuevos de la devolución se añaden con nota de origen (`src/lib/danos.ts`).
- Plan acordado (pendiente): (2) enlace de seguimiento + presupuestos con aprobación remota → (3) proforma con IVA/exento, reparto pagador y cobros, entrega en orden proforma→cobro→firma → (4) rediseño visual completo (sistema de diseño, accesibilidad, responsive PC/tablet/móvil). Después: emails, historial de comunicaciones/llamadas, agenda CRUD, import Excel, export facturación, ZIP fotos peritaje, lista diaria del perito, configuración de flujos, RLS, Docker en el VPS.
- Revisión general (2026-11-11), hecho: hora de Madrid en todo (servidor en UTC), freno de PIN por usuario+IP con espera creciente, seed protegido (solo talleres `config.demo`), reglas de estado en servidor (aprobación con nota, mecánico solo al siguiente, «Deshacer» 10 min), anti doble envío (recepción, devolución, préstamo), cabeceras de seguridad/CSP (solo producción), búsqueda global + histórico de entregadas (/buscar), filtros del tablero, indicadores de Inicio pulsables, aviso «listo» que respeta consentimiento y queda apuntado, editar datos de gestión de la OT, borrador de recepción, mantenimiento de coches de sustitución, iconos PWA.
- Decidido y hecho (2026-11-12): al avanzar de fase se pregunta a quién se pasa el trabajo (sugiere al especialista por el nombre, p. ej. «Marta (pintura)»); «Anular orden» (solo admin, con motivo) y «Retira sin reparar» (acta firmada específica); una avería adicional abierta solo avisa (en rojo), no bloquea; PIN de 6 cifras para admin y jefe de taller (4 para el resto).
- Sin decidir aún: ocultar datos del cliente al mecánico (de momento los ve), préstamo de coche sin OT.
- PIN: 6 cifras si la persona tiene puesto dirección o jefe de taller, 4 para el resto (`longitudPin(puestos)`).
- Importes (parte A, hecho): líneas «vivas» en la OT (`lineas_ot`: mano de obra h × €/h por especialidad, piezas con ref. y descuento, otros conceptos que admiten negativo), tarifas €/h SIN IVA por especialidad (mecánica, chapa, pintura, lunas) e IVA general en Configuración › Datos del taller. Por orden: con IVA o exento (con motivo legal; por defecto el del cliente) y precios tecleados sin IVA o con IVA incluido (al cambiar se convierten las líneas y el total no varía). Cálculo en céntimos con BigInt en `src/lib/importes.ts` (con IVA incluido el total cuadra con lo tecleado y la base se saca del total). Permiso `importes` = dirección, recepción, facturación, jefe de taller; el mecánico ve «Trabajo previsto» (piezas y horas, sin precios).
- Presupuestos (parte B, hecho): tabla `presupuestos` = copia inmutable de las líneas con IVA y totales (nº `<OT>-P<n>`, inicial/complementario, validez 12 días hábiles, uno nuevo sustituye al pendiente). Se acepta firmando en la tablet (`/ot/<id>/presupuesto/<pid>`), por enlace público en el móvil del cliente (`/p/<token>`, JWT con clave `:presupuestos`, nombre + firma + casilla de conformidad; también puede decir que no) o «Aprobado sin firma» desde la oficina (teléfono, aseguradora, perito; nota obligatoria). Aceptar con firma genera PDF con SHA-256 (tipo `presupuesto`, en «Documentos firmados»). Si la OT está en un estado «requiere aprobación», al aceptar avanza sola al siguiente (queda en el historial). Aviso si los importes cambian tras el aceptado. Lógica en `src/lib/presupuestos.ts`; texto legal configurable (`textoPresupuesto`).
- Siguiente: (C) proforma «no es factura» + cobros (efectivo, tarjeta, aseguradora/flota, pago dividido con franquicia) al entregar.

## Notas técnicas
- Node 20.18 necesita el override `magic-string 0.30.21` (ya en package.json) para Tailwind 4.
- Los scripts de `scripts/` importan `./env` primero para cargar `.env.local`.
- `npm run db:seed` borra y recrea el taller demo (nuevo id → las sesiones antiguas se invalidan, hay que volver a entrar). Solo actúa sobre talleres marcados `config.demo`; una demo antigua sin la marca: `SEED_FORZAR=1 npm run db:seed`.
- Fechas: usar `diaISO()`, `fmtFecha`, `fmtHora`, `inicioDia` de `lib/formato.ts` (zona Europe/Madrid); nunca `toISOString().slice(0,10)` para «hoy».
- Logo de demo en `scripts/demo/logo-valrodri.png` (sacado de su web; el repo es público en GitHub → valorar ponerlo privado).
- Al comprobar tipos, filtrar errores de `.next/` (tipos generados obsoletos).
- En modo desarrollo (Turbopack) Chrome da a veces un falso «Hydration failed» en el tablero o la ficha de la OT; en producción no aparece (comprobado). Tras cambiar `schema.ts`, reiniciar el servidor de desarrollo (si no, `t.<tabla>` llega undefined).
- En páginas de servidor, no usar una `const` dentro de un `await Promise.all(... .map(async …))` antes de declararla: TypeScript no lo detecta y da ReferenceError en ejecución.
- Responsive: en globals.css, `.grid > * { min-width: 0 }`, toda `.grid` con una columna `minmax(0,1fr)` por defecto (capa base; Safari del iPhone ensanchaba la columna al largo del SHA-256) y `overflow-x: clip` en html/body como red de seguridad. Revisar siempre a 390 px y 768 px, también en WebKit (Safari), no solo en Chrome.
