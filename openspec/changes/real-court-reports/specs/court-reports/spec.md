## Purpose

Muestra al administrador cómo rinden las canchas del club en un período, con datos reales de turnos y cobros, y le deja un resumen listo para compartir por WhatsApp.

## ADDED Requirements

### Requirement: Reporte por período
La pantalla Reportes SHALL mostrar, solo al `admin`, los datos reales del club para un período elegido: Hoy (por defecto), Ayer, Últimos 7 días o Este mes (hasta hoy). SHALL mostrar los ingresos cobrados, la cantidad de turnos activos y de cancelados, la ocupación de las canchas y lo que falta cobrar. Los demás roles NO SHALL acceder.

#### Scenario: Reporte de hoy
- **WHEN** el admin abre Reportes un día con 6 turnos activos y cobros por $38.200
- **THEN** ve esos ingresos, 6 turnos, la ocupación calculada y lo que falta cobrar

#### Scenario: Cambiar de período
- **WHEN** el admin elige "Últimos 7 días"
- **THEN** todos los números pasan a incluir los turnos y cobros de los últimos 7 días, incluido hoy

#### Scenario: Operador
- **WHEN** un operador abre Reportes
- **THEN** ve el aviso de que solo el administrador puede ver los reportes

### Requirement: Criterios de cálculo
Los ingresos SHALL ser las señas y cobros registrados en el período, aunque después hayan pasado a saldo a favor, sin contar el saldo a favor aplicado (igual que Caja). La ocupación SHALL ser los minutos de turnos activos sobre los minutos disponibles: los días del período por cada cancha activa por el horario del club. Lo que falta cobrar SHALL sumar, en los turnos activos del período que ya empezaron o son de hoy, el valor del turno menos lo cobrado no liberado.

#### Scenario: Ocupación
- **WHEN** un club abierto de 09:00 a 22:00 con 2 canchas tiene 13 horas de turnos activos en un día
- **THEN** la ocupación del día es 50 %

#### Scenario: Saldo a favor
- **WHEN** un turno se cobra con saldo a favor
- **THEN** ese cobro no suma a los ingresos del reporte

### Requirement: Rendimiento por cancha
El reporte SHALL listar cada cancha activa con sus turnos, horas reservadas, ocupación e ingresos del período, de mayor a menor ocupación.

#### Scenario: Cancha sin movimiento
- **WHEN** una cancha no tuvo turnos en el período
- **THEN** aparece con 0 turnos y 0 % de ocupación

### Requirement: Horarios y tipos de turno
El reporte SHALL mostrar cuántos turnos activos empiezan en cada hora y cuántos hay de cada tipo (estándar, profe, torneo), con cuántos son turnos fijos.

#### Scenario: Hora más pedida
- **WHEN** 7 turnos empiezan a las 20:00 y es la hora con más turnos
- **THEN** el reporte la muestra primera con ese número

### Requirement: Para revisar
El reporte SHALL avisar de lo que conviene revisar: turnos de los últimos 30 días ya pasados con saldo sin cobrar (cantidad y monto), cancelaciones tardías del período, deportes con canchas pero sin precio cargado y canchas sin turnos en el período. SHALL indicar que todo está en orden si no hay nada. NO SHALL mostrar alertas de stock.

#### Scenario: Deporte sin precio
- **WHEN** hay canchas de pádel y el precio del público de pádel es $0
- **THEN** el reporte avisa que pádel no tiene precio cargado

#### Scenario: Todo en orden
- **WHEN** no hay saldos sin cobrar, cancelaciones tardías ni canchas sin turnos
- **THEN** el reporte dice que no hay nada para revisar

### Requirement: Resumen para WhatsApp
El reporte SHALL ofrecer un texto con el nombre del club, el período, los ingresos, los turnos, la ocupación, lo que falta cobrar y la cancha y el horario más pedidos, con un botón para copiarlo.

#### Scenario: Copiar el resumen
- **WHEN** el admin toca "Copiar"
- **THEN** el texto queda en el portapapeles listo para pegar en WhatsApp
