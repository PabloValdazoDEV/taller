# Visita a Taller Valrodri: cómo plantearlo

Notas para preparar la primera visita (propuesta proactiva: aún no nos han contactado).
Cuando Pablo vaya a llevarlo al taller, pedirá a Claude que le ayude a prepararlo partiendo de aquí.

## Antes de ir
- [ ] Terminar el **bloque 2**: enlace de seguimiento para el cliente + aprobación del presupuesto desde el móvil. Es lo que más luce, porque el dueño lo ve en su propio móvil.
- [ ] Que la demo **no dependa de la wifi de casa**:
  - Lo mejor: desplegarla en el VPS con HTTPS (`docs/DESPLIEGUE.md`). Así la cámara del móvil funciona.
  - Alternativa: compartir datos desde el móvil y conectar a esa red el portátil y la tablet.
- [ ] Recrear los datos de demo justo antes (`npm run db:seed`) para que esté limpia, con su logo.
- [ ] **Decidir el precio.** Lo normal es una cuota mensual por taller, con o sin puesta en marcha. Seguro que lo preguntan.
- [ ] Llevar impresa la hoja de preguntas (abajo) y un guion corto de la demo.

## En la visita
- **Ir en persona**, a media mañana (11:00–12:30) o a primera hora de la tarde. Evitar la apertura y el cierre (~18:00), cuando entran y recogen coches.
- **Escuchar antes de enseñar:**
  - Cómo hacen hoy la recepción.
  - Cuántas llamadas reciben de «¿cómo va mi coche?».
  - Cómo controlan los coches de sustitución y sus daños.
- **Demo de unos 10 minutos y 3–4 cosas:**
  1. Recepción con firma en la tablet, que genera el PDF del resguardo.
  2. El cliente sigue su coche desde el móvil (enlace de seguimiento).
  3. El buscador con «qué decirle» cuando llama un cliente.
  4. El préstamo de un coche de sustitución con sus daños guardados en la ficha.
- **No presentarlo como sustituto de su programa de facturación/stock:** la app gestiona el taller y ellos siguen facturando con su programa (Verifactu).
- **Cerrar con algo concreto:** por ejemplo, «os lo dejo un mes de prueba gratis con vuestros datos».

## Qué preguntarles (hoja para llevar)
1. **Facturación:**
   - ¿Qué programa usan para facturar y para el stock?
   - ¿Ya cumple Verifactu?
   - ¿Permite importar o exportar datos (Excel, CSV)?
   - ¿Quién factura en el taller?
2. **Presupuestos:**
   - ¿Los hacen en ese programa o a mano?
   - ¿Cuándo tiene que aceptarlos el cliente antes de empezar?
3. **Clientes y vehículos:** ¿pueden pasarnos un Excel de ejemplo para importarlos?
4. **IVA:** ¿qué clientes tienen exentos y con qué motivo legal?
5. **Textos legales:** resguardo de depósito, condiciones, garantía y protección de datos que usan ahora.
6. **Aseguradoras y flotas:**
   - ¿Con cuáles trabajan (Mutua Madrileña, Bansacar…)?
   - ¿Cómo funciona el perito diario?
7. **Coches de sustitución:** ¿cuántos tienen, con qué matrículas y modelos, y en qué estado (daños)?
8. **Personas y puestos:** quién recibe, quién atiende el teléfono, quién factura, el jefe de taller y los mecánicos.
9. **Equipos:** ¿tienen tablet en recepción y PC en la oficina? ¿Los mecánicos usan móvil?
10. **Sello del taller:** una foto o escaneo de su sello (mejor en PNG con fondo transparente) para los PDF.
11. **Dominio y correo:** ¿qué dominio y qué SMTP usan para enviar emails (tallercochesvallecas.es)?

## Pendiente de ellos (resumen, también en CLAUDE.md)
- Excel de ejemplo.
- Datos y textos legales.
- Aseguradoras.
- Número de coches de sustitución.
- Programa de facturación.
- Dominio y SMTP.
- Sello del taller escaneado.
