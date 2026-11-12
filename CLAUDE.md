# Contexto para Claude

App de gestión integral de taller (recepción con firma → trabajo → incidencias → entrega), multi-taller para revender.
Spec completa: `docs/ESPECIFICACION.md`. Despliegue: `docs/DESPLIEGUE.md`. Cómo arrancar y estado: `README.md`.

## Cómo trabajar con el usuario
- Pregúntale ante cualquier decisión con dudas en vez de decidir solo. Habla en español.
- No hagas commit/push salvo que lo pida. Nunca subas `.env.local`.
- Facturación siempre legal (con factura); no ayudar a cobrar "en negro".

## Decisiones acordadas
- Stack: Next.js 15 (App Router, Server Actions) + TypeScript + Tailwind 4 + PostgreSQL + Drizzle. Hosting en VPS propio (Ubuntu + Plesk, Arsys) con Docker Compose; nada de Vercel/Supabase.
- Multi-tenant: `taller_id` en todas las tablas, taller por subdominio (`DEFAULT_TALLER_SLUG` en local). RLS pendiente.
- Login por PIN (JWT con jose). Roles: admin, asesor, jefe_taller, mecanico.
- Dispositivos: PC oficina, tablet recepción (firma/fotos), móvil mecánicos. Pantalla TV aplazada.
- Firma manuscrita en tablet → PDF inmutable con hash SHA-256. Envío por WhatsApp (Web Share + enlace firmado `/d/<token>`).
- Flujos configurables por tipo de orden (mantenimiento, avería, siniestro aseguradora, renting, lunas, neumáticos, garantía).
- Incidencias: avería adicional, retraso piezas, daño en taller, reclamación.
- Presupuesto: firma en recepción o aprobación a distancia por enlace.
- Facturación: proforma en la app; factura legal en programa externo con Verifactu. Clientes exentos de IVA. Cobros: efectivo, tarjeta, aseguradora/flota (pago dividido).
- Avisos: email/teléfono primero; WhatsApp/SMS más adelante.
- Stock, fichaje y pedidos: "en la recámara", no es lo principal.
- Importación de Excel: formato aún desconocido → importador con mapeo de columnas flexible.

## Contexto comercial
- Propuesta PROACTIVA a Taller Valrodri (VALRODRI S.L., Vallecas, https://tallercochesvallecas.es/): concertado Mutua Madrileña y Bansacar, perito diario, coches de sustitución. Aún no han contactado; pruebas internas con datos ficticios.
- Pendiente de ellos: Excel de ejemplo, datos/textos legales, aseguradoras, nº coches sustitución, programa de facturación, dominio y SMTP.

## Estado
- Hecho (demo probada E2E): recepción 5 pasos + firma + PDF, tablero, OT, incidencias, móvil mecánico, coche sustitución, entrega con fotos antes/después, selector marca/modelo con logos, daños en 5 vistas, barra lateral plegable, envío por WhatsApp, sección Clientes.
- Revisión general (2026-11-11), hecho: hora de Madrid en todo (servidor en UTC), freno de PIN por usuario+IP con espera creciente, seed protegido (solo talleres `config.demo`), reglas de estado en servidor (aprobación con nota, mecánico solo al siguiente, «Deshacer» 10 min), anti doble envío (recepción, devolución, préstamo), cabeceras de seguridad/CSP (solo producción), búsqueda global + histórico de entregadas (/buscar), filtros del tablero, indicadores de Inicio pulsables, aviso «listo» que respeta consentimiento y queda apuntado, editar datos de gestión de la OT, borrador de recepción, mantenimiento de coches de sustitución, iconos PWA.
- Decidido y hecho (2026-11-12): al avanzar de fase se pregunta a quién se pasa el trabajo (sugiere al especialista por el nombre, p. ej. «Marta (pintura)»); «Anular orden» (solo admin, con motivo) y «Retira sin reparar» (acta firmada específica); una avería adicional abierta solo avisa (en rojo), no bloquea; PIN de 6 cifras para admin y jefe de taller (4 para el resto).
- Sin decidir aún: ocultar datos del cliente al mecánico (de momento los ve), préstamo de coche sin OT.
- Siguiente bloque MVP: presupuestos (firma + aprobación remota), proforma con IVA/exento y reparto pagador, cobros. Luego: emails, agenda CRUD, import Excel, export facturación, ZIP fotos peritaje, configuración desde la app, RLS, probar Docker en el VPS.

## Notas técnicas
- Node 20.18 necesita el override `magic-string 0.30.21` (ya en package.json) para Tailwind 4.
- Los scripts de `scripts/` importan `./env` primero para cargar `.env.local`.
- `npm run db:seed` borra y recrea el taller demo (nuevo id → las sesiones antiguas se invalidan, hay que volver a entrar). Solo actúa sobre talleres marcados `config.demo`; una demo antigua sin la marca: `SEED_FORZAR=1 npm run db:seed`.
- Fechas: usar `diaISO()`, `fmtFecha`, `fmtHora`, `inicioDia` de `lib/formato.ts` (zona Europe/Madrid); nunca `toISOString().slice(0,10)` para «hoy».
- Al comprobar tipos, filtrar errores de `.next/` (tipos generados obsoletos).
