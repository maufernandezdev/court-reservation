## Purpose

Define la pantalla "Hoy", la primera que ve el equipo del club: qué pasa ahora en cada cancha, qué viene, qué falta cobrar y qué turnos quedan libres para ofrecer.

## ADDED Requirements

### Requirement: Resumen del día
La pantalla Hoy (`/dashboard`) SHALL mostrar, para la fecha actual y el club del usuario: cantidad de turnos activos (y cancelados), porcentaje de ocupación (minutos reservados sobre minutos abiertos de las canchas activas), total cobrado del día y total pendiente de cobro con la cantidad de turnos. Todos los valores MUST calcularse con datos reales; si un dato no está disponible para el rol del usuario, MUST omitirse en lugar de mostrar un valor inventado.

#### Scenario: Día con reservas
- **WHEN** el club tiene 3 turnos activos hoy, uno pagado de $24.000 y uno señado con $7.200
- **THEN** Hoy muestra 3 turnos, cobrado $31.200 y por cobrar el saldo de los turnos no pagados

#### Scenario: Club sin canchas
- **WHEN** el club todavía no tiene canchas
- **THEN** Hoy muestra un estado vacío con acceso a crear la primera cancha

### Requirement: Ahora en cancha
Hoy SHALL mostrar una tarjeta por cancha activa con su estado en el momento actual: ocupada (quién juega y a qué hora termina, con el estilo del estado de pago) o libre (hasta qué hora). El filtro por deporte MUST seguir disponible.

#### Scenario: Cancha libre
- **WHEN** una cancha no tiene turno en curso y su próximo turno es a las 19:00
- **THEN** su tarjeta dice "Libre" y "Hasta 19:00"

### Requirement: Próximos turnos con acceso al cobro
Hoy SHALL listar los próximos turnos activos del día en orden de horario, con cancha, cliente y estado de pago, y para los no pagados un botón "Cobrar" con el monto que falta, que abre el detalle del turno con el flujo de cobro existente.

#### Scenario: Cobrar desde Hoy
- **WHEN** el operador toca "Cobrar $16.800" en un turno señado
- **THEN** se abre el detalle de ese turno listo para registrar el cobro, y al guardarlo Hoy se actualiza

### Requirement: Huecos libres para ofrecer
Hoy SHALL listar los huecos libres que quedan desde la hora actual hasta el cierre (rango y cancha) y ofrecer "Copiar para WhatsApp", que copia al portapapeles un texto en español con esos huecos.

#### Scenario: Copiar disponibilidad
- **WHEN** el usuario toca "Copiar para WhatsApp"
- **THEN** el texto con los huecos queda en el portapapeles y se confirma con un aviso "Copiado"
