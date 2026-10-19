## Purpose

Lleva el seguimiento de la suscripción mensual que cada club paga por usar la aplicación: planes, prueba gratis, pagos mes a mes y saber en cualquier momento si el club está al día. Deja el modelo listo para cobrar con Mercado Pago sin implementar todavía la integración.

## ADDED Requirements

### Requirement: Planes de suscripción
El sistema SHALL ofrecer tres planes según la cantidad de canchas del club, sin importar el tipo de cancha: **Inicial** (hasta 3 canchas, $15.000 por mes), **Club** (hasta 6 canchas, $25.000 por mes) y **Gran Club** (7 o más canchas, sin tope, $35.000 por mes). El precio anual SHALL tener un 10 % de descuento sobre doce meses. Cualquier usuario con sesión SHALL poder consultar los planes.

#### Scenario: Ver los planes
- **WHEN** un usuario con sesión abre Suscripción
- **THEN** ve los tres planes con su límite de canchas y su precio mensual y anual

#### Scenario: Canchas de distintos tipos
- **WHEN** un club tiene 4 canchas de tenis y 1 de fútbol
- **THEN** cuenta 5 canchas contra el límite de su plan

### Requirement: Prueba gratis de 30 días
Al crearse, cada club SHALL recibir una suscripción en prueba de 30 días sin pago. El plan inicial SHALL ser el más chico que alcance para las canchas cargadas al crear el club.

#### Scenario: Club nuevo con 5 canchas
- **WHEN** una persona crea su club con 5 canchas
- **THEN** el club queda en prueba por 30 días con el plan Club

#### Scenario: Club nuevo con 2 canchas
- **WHEN** una persona crea su club con 2 canchas
- **THEN** el club queda en prueba por 30 días con el plan Inicial

### Requirement: Estado de la suscripción
El sistema SHALL poder informar el estado de cada club como **prueba**, **al día**, **en gracia** o **vencido**, calculado con las fechas y sin depender de un proceso programado. La prueba y los períodos pagados SHALL vencer al terminar su último día. Pasado el vencimiento, el club SHALL tener 5 días de gracia (ajustables por club) antes de quedar vencido. Cualquier miembro del club SHALL poder consultar el estado, los días restantes, las canchas usadas y el límite; solo el `admin` SHALL ver el monto y el historial de pagos.

#### Scenario: Prueba vigente
- **WHEN** un club está en el día 10 de su prueba
- **THEN** su estado es "prueba" y faltan 20 días

#### Scenario: Prueba terminada, dentro de la gracia
- **WHEN** pasaron 3 días desde que terminó la prueba y el club no pagó
- **THEN** su estado es "en gracia" y quedan 2 días antes de pasar a vencido

#### Scenario: Gracia agotada
- **WHEN** pasaron más de 5 días desde el vencimiento sin pago
- **THEN** su estado es "vencido"

#### Scenario: Operador consulta el estado
- **WHEN** un operador consulta el estado de su club
- **THEN** ve el estado y las fechas, pero no los montos ni el historial de pagos

### Requirement: Registro de pagos de la suscripción
El sistema SHALL guardar un registro por cada pago de la suscripción con club, plan, monto, moneda, período cubierto (desde y hasta), medio de pago (Mercado Pago), estado (aprobado, pendiente, rechazado o devuelto), fecha de pago y los datos externos de Mercado Pago (identificador del pago, identificador de la suscripción recurrente, referencia externa y respuesta completa). Un identificador de pago de Mercado Pago SHALL poder registrarse una sola vez. Registrar un pago aprobado SHALL activar la suscripción y extender el fin del período pagado según el ciclo (un mes o un año) a partir del vencimiento vigente o de la fecha de pago, lo que sea posterior. Solo el dueño del producto, con acceso de servicio, SHALL poder registrar pagos y cambiar planes; ningún usuario del club SHALL poder escribirlos.

#### Scenario: Primer pago después de la prueba
- **WHEN** se registra un pago aprobado mensual de un club cuya prueba terminó hace 2 días
- **THEN** el club pasa a "al día" y su período pagado vence un mes después de la fecha de pago

#### Scenario: Pago adelantado
- **WHEN** se registra un pago mensual aprobado de un club al día cuyo período vence en 10 días
- **THEN** el nuevo vencimiento es un mes después del vencimiento anterior

#### Scenario: Pago repetido
- **WHEN** se intenta registrar dos veces el mismo identificador de pago de Mercado Pago
- **THEN** el segundo intento no crea otro registro ni extiende el período

#### Scenario: Pago no aprobado
- **WHEN** se registra un pago rechazado o pendiente
- **THEN** queda en el historial pero no cambia el vencimiento del club

#### Scenario: Admin intenta escribir un pago
- **WHEN** el admin de un club intenta crear o modificar un pago de su suscripción
- **THEN** el sistema lo rechaza

#### Scenario: Aislamiento entre clubes
- **WHEN** el admin de un club consulta pagos de suscripción
- **THEN** solo ve los de su club

### Requirement: Pantalla de Suscripción
La pantalla `/dashboard/suscripcion` SHALL mostrar datos reales del club: plan actual, estado, vencimiento, días restantes de prueba o de gracia, canchas usadas contra el límite y el historial de pagos con fecha, período, monto y estado. SHALL mostrar los planes con el actual destacado. El botón para pagar o cambiar de plan SHALL estar deshabilitado con el texto "Próximamente" hasta que se integre Mercado Pago. Solo el `admin` SHALL acceder.

#### Scenario: Club en prueba
- **WHEN** el admin de un club en prueba abre Suscripción
- **THEN** ve "Prueba gratis", los días restantes, las canchas usadas contra el límite y el historial vacío

#### Scenario: Botón de pago
- **WHEN** el admin mira el botón para pagar
- **THEN** está deshabilitado y dice "Próximamente"

### Requirement: Avisos en el panel
El panel SHALL mostrar un aviso a los miembros del club cuando la prueba o el período pagado vence en 7 días o menos, cuando el club está en gracia y cuando está vencido (solo lectura). El aviso SHALL indicar la fecha y, para el `admin`, enlazar a Suscripción.

#### Scenario: Prueba por terminar
- **WHEN** a la prueba de un club le quedan 5 días
- **THEN** el panel muestra un aviso con la fecha de fin

#### Scenario: Club al día
- **WHEN** a un club con período pagado le quedan 20 días
- **THEN** el panel no muestra ningún aviso
