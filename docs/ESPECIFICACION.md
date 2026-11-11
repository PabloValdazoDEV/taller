# App de gestión de taller — Especificación v0.1

> Estado: borrador para revisión · Fecha: 2026-11-10

## 1. Objetivo

Gestionar el ciclo completo de un vehículo en un taller (mecánica general + chapa y pintura). La app es **multi-taller (multi-tenant)** desde el principio: cada taller tiene sus datos aislados, para poder ofrecerla a otros talleres. Valrodri sería el primero.

**Cita → Recepción (fotos, checklist, firma) → Trabajo en taller (flujo según tipo de orden, incidencias) → Entrega (firma, proforma, cobro)**

Además se podrán importar datos desde Excel. La factura legal **no** la emite esta app: la emite un programa externo que cumple Verifactu.

### Taller objetivo (propuesta proactiva)
**Taller Valrodri — VALRODRI, S.L.** · C/ Cerámica 82-84, Patio 7, Pol. Ind. La Cerámica, 28038 Madrid · <https://tallercochesvallecas.es/>
Información de su web, pendiente de confirmar con ellos:
- Más de 40 años de actividad. Horario L-V 8:30-14:00 y 15:00-18:00.
- Servicios: chapa y pintura, mecánica general, **lunas/parabrisas**, **neumáticos**, lacado de faros, limpieza y revisión de niveles en la entrega.
- **Taller concertado de Mutua Madrileña** y colaborador de **Bansacar (renting del Banco Santander)**. Dicen trabajar con "todas las aseguradoras".
- Peritación: **visita diaria del perito** al taller y **fotoperitación**.
- **Coche de sustitución** gratuito con condiciones (lo cubre la póliza o es cortesía para autónomos).
- Atención al cliente por teléfono, **WhatsApp** y email.

> Mientras no haya contacto con el taller, el desarrollo se prueba con **datos ficticios**.

Enfoque: **MVP primero, con la arquitectura preparada** para las fases siguientes (stock, fichaje, WhatsApp/SMS, pantalla TV, integración con facturación).

---

## 2. Decisiones técnicas

| Área | Decisión | Motivo |
|---|---|---|
| Tipo de app | Web responsive + **PWA** (instalable en tablet/móvil) | Un solo código para PC, tablet y móvil |
| Framework | **Next.js (App Router) + TypeScript** | Front y back en un solo proyecto |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles y táctiles |
| Base de datos | **PostgreSQL** | Elegida por el usuario; JSONB para el checklist |
| Multi-taller | Columna `taller_id` en todas las tablas de negocio + **Row Level Security** de PostgreSQL; cada taller en su subdominio (`valrodri.tuapp.es`) | Aislamiento de datos garantizado por la propia base de datos |
| ORM / migraciones | Drizzle ORM | Tipado, migraciones versionadas en SQL |
| Autenticación | Usuario con email + contraseña; **PIN de 4 dígitos** en dispositivos compartidos | Cada acción queda asociada a una persona |
| Firma | Captura manuscrita en canvas (`signature_pad`) | Ver §6 |
| PDF | Generación en servidor (`@react-pdf/renderer`) + **hash SHA-256** | Documento inalterable |
| Excel | `exceljs` + asistente de mapeo de columnas | El formato del Excel aún no se conoce |
| Email | SMTP (cuenta del dominio en Plesk) vía `nodemailer` | Sin coste adicional |
| Tareas en segundo plano | `pg-boss` (cola sobre PostgreSQL) | Envío de emails y generación de PDFs sin bloquear |
| Ficheros (fotos/PDF) | Disco del VPS (volumen Docker), con capa de abstracción | Permite pasar a S3/MinIO sin cambiar el código |
| Tiempo real (tablero) | Server-Sent Events / sondeo cada pocos segundos | Suficiente para un solo taller |
| Despliegue | **VPS Ubuntu + Plesk (Arsys)**: Docker Compose (app + PostgreSQL), nginx de Plesk como proxy inverso + Let's Encrypt | Infraestructura propia del usuario |
| Copias de seguridad | `pg_dump` diario + copia de la carpeta de ficheros, con rotación | Obligatorio antes de usarla en producción |

---

## 3. Roles y permisos

| Rol | Puede |
|---|---|
| **Administrador/jefe** | Todo: configuración, usuarios, tipos de orden y flujos, informes, exportaciones, importación de Excel |
| **Recepcionista/asesor** | Agenda, clientes y vehículos, recepción, presupuestos, comunicación con el cliente, entrega, proforma y cobro |
| **Jefe de taller** | Tablero, asignación de trabajos a mecánicos, cambio de estados, control de calidad, incidencias |
| **Mecánico** | Ver sus trabajos asignados, avanzar el estado de su tarea, abrir incidencias con fotos y añadir notas |

Todas las acciones relevantes se registran en una **auditoría** (quién, cuándo, qué y desde qué dispositivo).

---

## 4. Tipos de orden y flujos (configurables)

Cada orden de trabajo (OT) tiene un **tipo de orden** y cada tipo tiene su propia **secuencia de estados**. El administrador puede crear tipos, renombrar estados y cambiar su orden. Estos son los flujos iniciales:

**Mantenimiento** (revisión, aceite, distribución…). El presupuesto se cierra en la recepción.
`Recepcionado → En reparación → Control de calidad → Listo → Entregado`

**Avería mecánica / golpe particular** (sin aseguradora)
`Recepcionado → En diagnóstico → Pendiente de aprobación → Esperando piezas → En reparación → Control de calidad → Listo → Entregado`

**Siniestro de aseguradora** (chapa y pintura)
`Recepcionado → Pendiente de peritaje → Peritado/valoración aprobada → Esperando piezas → Chapa → Pintura → Montaje → Control de calidad → Listo → Entregado`
Campos extra: aseguradora, nº de siniestro, nº de póliza, perito (nombre/contacto), fecha de peritaje, franquicia, ¿cubre coche de sustitución?
Herramientas para el perito: **lista diaria de vehículos pendientes de peritaje** (el perito pasa a diario) y exportación de las fotos de una OT en un ZIP para la **fotoperitación**.

**Renting / flota** (Bansacar, etc.): igual que el siniestro, pero la autorización y el pago corresponden a la compañía de renting. Campos: compañía, nº de contrato, nº de autorización.

**Lunas / parabrisas** (rápido)
`Recepcionado → Esperando luna → Sustitución/reparación → Listo → Entregado`

**Neumáticos** (rápido)
`Recepcionado → En montaje → Listo → Entregado`

**Garantía / reclamación**: la OT queda vinculada a la OT original (ver §5).

Reglas:
- Un estado puede marcarse como *saltable* (por ejemplo, "Esperando piezas" si no hacen falta piezas).
- "Pendiente de aprobación" bloquea el avance hasta que el cliente o la aseguradora aprueban.
- Cada cambio de estado se guarda en un historial con usuario y hora.
- Podrá configurarse qué estados envían un aviso al cliente (por ejemplo, "Listo").

---

## 5. Incidencias

| Tipo | Qué ocurre |
|---|---|
| **Avería adicional** | El mecánico la abre con fotos → el asesor añade líneas a un **nuevo presupuesto complementario** → el cliente lo aprueba en tablet o por enlace remoto → la OT continúa |
| **Retraso de piezas** | Se registra la pieza, el proveedor y la nueva fecha → se recalcula la fecha prevista de entrega → se avisa al cliente |
| **Daño en el taller** | Registro interno con fotos y responsable; opcionalmente comunicado al seguro del taller. **No visible para el cliente** salvo que se decida lo contrario |
| **Reclamación / garantía** | El cliente vuelve tras la entrega → se abre una OT de tipo Garantía vinculada a la original y se comprueba si está dentro del plazo de garantía |

Cada incidencia tiene un estado (`abierta → en curso → resuelta / descartada`), fotos, comentarios y un indicador de si afecta al precio y/o al plazo.

---

## 6. Documentos y firma digital

**Documentos que se generan**
1. **Resguardo de depósito** (en la recepción): datos del cliente y del vehículo, km, combustible, checklist de daños, objetos personales, fotos (miniaturas + referencia), trabajo solicitado, fecha prevista, condiciones y firma del cliente.
2. **Presupuesto** (en la recepción o a distancia): líneas de piezas, mano de obra y otros conceptos, IVA o exención, validez y aceptación firmada.
3. **Acta de entrega**: km de salida, trabajos realizados, piezas sustituidas, garantía y firma de conformidad.
4. **Proforma / resumen de cobro** (no es una factura fiscal).

**Firma** (firma electrónica simple)
- El cliente firma en la tablet con el dedo o un lápiz.
- Se genera el PDF definitivo con la firma incrustada y se calcula su **SHA-256**.
- Se guardan como evidencia la fecha y hora del servidor, el usuario que atendió, el dispositivo y la IP.
- El PDF firmado no se puede modificar: cualquier cambio genera una **versión nueva**.
- Se envía una copia por email al cliente (si tiene email).

**Aprobación a distancia del presupuesto**: enlace único con caducidad → el cliente ve el presupuesto en el móvil → lo acepta o rechaza (con firma en pantalla o casilla + nombre) → se registran la IP y la hora.

### Checklist de recepción
- Silueta del vehículo (frontal, trasera, laterales y techo) para marcar los daños pulsando sobre ella: tipo (arañazo, abolladura, rotura, pintura) y foto asociada.
- Km, nivel de combustible (selector de 0 a 4/4) y testigos encendidos en el cuadro.
- Objetos dentro del vehículo y accesorios entregados (llaves, tapacubos, rueda de repuesto, documentación…).
- Fotos desde la cámara de la tablet o el móvil, comprimidas antes de subirlas.

---

## 7. Avisos al cliente

Arquitectura de **canales desacoplados**: la app genera un evento (por ejemplo, "presupuesto pendiente" o "vehículo listo") y un módulo lo envía por el canal disponible.

- **MVP**: email si el cliente tiene. Además, un botón **"Enviar por WhatsApp"** que abre WhatsApp (`wa.me`) con el mensaje ya escrito, para enviarlo desde el teléfono del taller: sin coste y sin API. Si no se puede usar ninguno de los dos, aparece una tarea *"Llamar al cliente"*.
- **Más adelante**: WhatsApp Business API y/o SMS, activables por cliente (consentimiento RGPD).
- Todos los avisos quedan registrados (canal, fecha, estado del envío).

---

## 8. Presupuestos, proforma y cobros

- **Líneas**: tipo (pieza / mano de obra / pintura-material / otros), referencia, descripción, cantidad, precio unitario, descuento y % de IVA.
- Las piezas son texto libre en el MVP (sin stock), pero en una tabla preparada para enlazarlas después a un catálogo.
- **IVA**: por defecto el general; el cliente o el documento pueden marcarse como **exento**, con su motivo legal, que aparece en el documento.
- **Varios pagadores**: en los siniestros, el importe se reparte entre el **cliente (franquicia)** y la **aseguradora** (resto).
- **Cobros**: efectivo, tarjeta (solo se registra; sin integración con el datáfono) o pendiente de la aseguradora/flota. Estado: pendiente / parcial / cobrado.
- **Exportación** de proformas y cobros a Excel/CSV para el programa de facturación externo. Su integración por API llegará en una fase posterior, cuando se sepa qué programa es.

---

## 8b. Coches de sustitución

- **Flota de cortesía**: matrícula, modelo, km, estado (disponible / prestado / en mantenimiento), ITV y seguro.
- **Préstamo** vinculado a una OT: comprobación de las condiciones (edad ≥ 25, carnet > 2 años; configurables), datos del carnet, km y combustible de salida, daños previos (la misma silueta que en la recepción) y **firma del contrato de préstamo**.
- **Devolución**: km y combustible de llegada, daños nuevos (se abre una incidencia si los hay) y firma.
- Quién paga: la aseguradora (si la póliza lo cubre), cortesía del taller o el cliente.
- Calendario de disponibilidad junto a la agenda.

---

## 9. Importación de Excel

El formato real aún no se conoce, así que el importador es **genérico**:

1. Se sube el fichero `.xlsx`/`.csv` → se elige la hoja.
2. **Mapeo de columnas**: columna del Excel → campo de la app (con autodetección por nombre).
3. **Vista previa y validación**: NIF, matrícula, emails y duplicados (por NIF, matrícula o bastidor).
4. Opciones: crear nuevos / actualizar existentes / omitir duplicados.
5. Informe final: filas importadas, actualizadas y con error (descargable).
6. Los mapeos se guardan como **plantillas** para reutilizarlos.

Entidades importables (MVP): **clientes, vehículos**. Después: histórico de reparaciones, cobros/pagos y cualquier otra que aparezca en los Excel reales.

---

## 10. Modelo de datos (resumen)

```
-- Todas las tablas de negocio llevan taller_id (FK a taller) y una política RLS.
taller(id, slug /*subdominio*/, nombre, nif, direccion, logo, plan, activo)
coche_sustitucion(id, matricula, modelo, km, estado, itv_hasta, seguro_hasta)
prestamo_sustitucion(id, coche_id, ot_id, conductor_nombre, conductor_dni,
                     carnet_fecha, km_salida, comb_salida, danos_salida JSONB,
                     km_llegada, comb_llegada, danos_llegada JSONB, pagador,
                     doc_salida_id, doc_llegada_id, salida_en, devuelto_en)
usuario(id, nombre, email, password_hash, pin_hash, rol, activo)
cliente(id, tipo[particular|empresa|aseguradora|flota], nombre, nif, telefono, email,
        direccion, exento_iva, motivo_exencion, acepta_whatsapp, acepta_email, notas)
vehiculo(id, cliente_id, matricula, bastidor, marca, modelo, version, anio,
         combustible, color, km_ultimo)
cita(id, cliente_id, vehiculo_id, fecha_hora, duracion, motivo, estado, ot_id)

tipo_orden(id, nombre, activo)
estado_flujo(id, tipo_orden_id, nombre, orden, saltable, requiere_aprobacion,
             notifica_cliente, es_final)

orden_trabajo(id, numero, tipo_orden_id, estado_actual_id, cliente_id, vehiculo_id,
              asesor_id, fecha_entrada, fecha_prevista, trabajo_solicitado,
              ot_origen_id /*garantía*/, datos_siniestro JSONB, cerrada_en)
historial_estado(id, ot_id, estado_id, usuario_id, fecha, comentario)
asignacion(id, ot_id, mecanico_id, tarea, estado)

recepcion(id, ot_id, km, combustible, checklist JSONB, objetos JSONB,
          testigos JSONB, documento_id)
entrega(id, ot_id, km, trabajos_realizados, piezas_sustituidas, garantia_texto,
        documento_id)

presupuesto(id, ot_id, version, tipo[inicial|complementario], estado
            [borrador|enviado|aprobado|rechazado], aprobado_por, aprobado_via
            [tablet|enlace], token_aprobacion, validez_hasta, documento_id)
linea_presupuesto(id, presupuesto_id, tipo, referencia, descripcion, cantidad,
                  precio, descuento, iva_pct, pieza_id NULL /*futuro stock*/)

incidencia(id, ot_id, tipo, descripcion, estado, visible_cliente, afecta_precio,
           afecta_plazo, nueva_fecha, creada_por, resuelta_por)

proforma(id, ot_id, numero, base, iva, total, exento, motivo_exencion, documento_id)
reparto_pago(id, proforma_id, pagador[cliente|aseguradora|flota], cliente_pagador_id, importe)
cobro(id, proforma_id, pagador, metodo[efectivo|tarjeta|transferencia|aseguradora],
      importe, fecha, usuario_id)

documento(id, tipo, ot_id, ruta_pdf, sha256, firmado, firmado_en, firma_ip,
          firma_dispositivo, version, sustituye_a)
archivo(id, entidad, entidad_id, ruta, tipo_mime, tamano, subido_por)  -- fotos
notificacion(id, ot_id, cliente_id, evento, canal, estado, enviado_en, error)
importacion(id, entidad, fichero, plantilla_mapeo JSONB, totales JSONB, usuario_id)
auditoria(id, usuario_id, accion, entidad, entidad_id, datos JSONB, ip, dispositivo, fecha)
config_taller(nombre, nif, direccion, logo, textos_legales, iva_defecto, garantia_defecto)
```

---

## 11. Pantallas del MVP

| Pantalla | Dispositivo principal |
|---|---|
| Login + selección de usuario por PIN | Todos |
| Inicio del asesor: citas del día, vehículos listos para entregar, presupuestos pendientes, llamadas pendientes | PC |
| Agenda (día/semana) | PC |
| Clientes y vehículos (búsqueda por matrícula, nombre, NIF o teléfono) | PC / tablet |
| **Asistente de recepción** (paso a paso: vehículo → checklist → fotos → trabajo → presupuesto → firma) | Tablet |
| Ficha de la OT: estado, historial, fotos, presupuestos, incidencias, documentos | PC / tablet |
| **Tablero** Kanban por tipo de orden | PC (después TV) |
| **Mis trabajos** (mecánico): lista, avance de estado, abrir incidencia con foto | Móvil |
| Aprobación de presupuesto (página pública con enlace) | Móvil del cliente |
| **Asistente de entrega** (resumen → proforma → cobro → firma) | Tablet |
| Importación de Excel | PC |
| Configuración: datos del taller, usuarios, tipos de orden y flujos, textos legales | PC |

---

## 12. Fases

**Fase 0 — Base técnica**
Proyecto Next.js + Docker Compose, PostgreSQL, migraciones, autenticación + PIN, roles, auditoría, almacenamiento de ficheros, despliegue en Plesk con dominio y HTTPS, copias de seguridad.

**Demo comercial (para Valrodri)** — 2-3 semanas, con datos ficticios
Recepción en tablet (fotos, daños sobre la silueta, firma → PDF) · tablero con un siniestro de Mutua avanzando por estados · vista móvil del mecánico con una incidencia · entrega con firma · préstamo de coche de sustitución con firma.

**Fase 1 — MVP**
Coches de sustitución · clientes/vehículos · agenda · recepción con checklist, fotos y firma + PDF · tipos de orden y flujos · tablero · asignación a mecánicos y vista móvil · incidencias · presupuestos (firma en tablet y aprobación por enlace) · entrega con firma · proforma con IVA/exento y reparto de pagadores · cobros · avisos por email y tareas de llamada · importación de Excel (clientes y vehículos) · exportación a CSV/Excel.

**Fase 2**
Pantalla TV · informes (tiempos por estado, OTs por tipo, cobros pendientes) · importación de histórico · garantías con control de plazo/km.

**Fase 3 (en la recámara)**
WhatsApp/SMS · integración con el programa de facturación · fichaje de horas · catálogo de piezas y stock · pedidos a proveedores.

---

## 13. Aspectos legales a validar (con el taller o la gestoría)

- **RD 1457/1986 (talleres de reparación de vehículos)**: presupuesto por escrito salvo renuncia expresa del cliente, resguardo de depósito, garantía mínima (habitualmente 3 meses o 2.000 km), piezas sustituidas a disposición del cliente y aviso de hojas de reclamaciones. Además, revisar la **normativa autonómica** aplicable. → Lo incorporaremos a los textos de los documentos y a la casilla de "renuncia a presupuesto".
- **RGPD**: cláusula informativa en el resguardo, consentimiento para las comunicaciones (email/WhatsApp), plazos de conservación de fotos y firmas.
- **Verifactu**: no aplica a esta app mientras no emita facturas; la proforma debe indicar claramente que *no es una factura*.

---

## 14. Pendiente de información

- [ ] **Excel de ejemplo** (aunque sea con datos falsos) para afinar la importación.
- [ ] Datos del taller: nombre comercial, NIF, dirección, logo y textos legales actuales (si ya tenéis un resguardo en papel, una foto de él).
- [x] ~~Confirmar si hacen neumáticos~~ → sí, según su web.
- [ ] Con qué aseguradoras trabajan, además de Mutua Madrileña, y cómo reciben los encargos (¿portal de la aseguradora? ¿Excel?).
- [ ] Cuántos coches de sustitución tienen y qué contrato de préstamo firman ahora.
- [ ] Qué **programa de facturación** usa el taller o su gestoría.
- [ ] Dominio o subdominio para la app (por ejemplo, `taller.tudominio.es`) y una cuenta SMTP para enviar emails.
- [ ] En Plesk: comprobar que está disponible la **extensión Docker** (o acceso SSH con permisos para instalar Docker).
- [ ] Número aproximado de usuarios y de vehículos al mes (para dimensionar el VPS y las copias de seguridad).
