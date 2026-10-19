## Purpose

Que cada profesor vea sus propios turnos del día, de la semana y del pasado.

## ADDED Requirements

### Requirement: Mis turnos
El `profesor` SHALL tener una sección "Mis turnos" con los turnos de profe que reservó a su nombre en el club activo, y ninguna otra persona SHALL verla en el menú. Cada turno SHALL mostrar fecha, horario de inicio a fin, cancha, alumnos, si es fijo y su estado (pendiente, señado, pagado o cancelado).

#### Scenario: Otro rol
- **WHEN** un administrador o un operador abre `/dashboard/mis-turnos`
- **THEN** ve el aviso de que la sección es para profesores

### Requirement: Vista de hoy
La vista "Hoy" SHALL listar los turnos del profesor de la fecha actual ordenados por horario, y SHALL indicar cuando no tiene ninguno.

#### Scenario: Día con dos turnos
- **WHEN** un profesor tiene turnos a las 18:00 y a las 19:30
- **THEN** los ve en ese orden con su cancha y sus alumnos

### Requirement: Vista semanal
La vista "Semana" SHALL mostrar de lunes a domingo los turnos del profesor agrupados por día, con la cantidad de cada día, y SHALL permitir ir a la semana anterior, a la siguiente y volver a la actual. Los turnos fijos de semanas futuras SHALL aparecer aunque nadie haya abierto antes la planilla de esas fechas.

#### Scenario: Semana siguiente
- **WHEN** el profesor tiene un turno fijo los martes y avanza a la semana siguiente
- **THEN** ve ese turno en el martes de esa semana

### Requirement: Historial
La vista "Historial" SHALL listar los turnos pasados del profesor de un mes elegido (el actual por defecto), del más reciente al más antiguo y agrupados por día, con el total de turnos, de horas y de cancelados del mes. SHALL permitir cambiar de mes sin pasar del actual.

#### Scenario: Mes anterior
- **WHEN** el profesor elige el mes anterior
- **THEN** ve sus turnos de ese mes con los totales correspondientes
