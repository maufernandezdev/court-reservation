## Purpose

Permite reservar un turno que se repite todas las semanas (mismo día, hora y cancha) hasta darlo de baja, con cada fecha manejada como un turno normal.

## ADDED Requirements

### Requirement: Crear un turno fijo
Al cargar un turno estándar o de profe, el staff (y el profesor para sus propios turnos) SHALL poder marcarlo como fijo semanal. El sistema SHALL reservar esa cancha, día de la semana y hora para todas las semanas siguientes, sin fecha de fin. Las fechas en que la cancha ya esté ocupada SHALL saltearse, y al crear el fijo el sistema SHALL informar cuáles se saltearon. Los turnos de torneo NO SHALL poder ser fijos.

#### Scenario: Fijo de los lunes
- **WHEN** el operador carga un turno fijo para el lunes 19/10 a las 09:00 en Cancha 1
- **THEN** la planilla muestra ese turno todos los lunes siguientes a las 09:00 en Cancha 1

#### Scenario: Semana ocupada
- **WHEN** el lunes 2/11 a las 09:00 la Cancha 1 ya tiene un turno
- **THEN** el fijo se crea igual, esa fecha queda sin el fijo y el sistema avisa que se salteó el 2/11

#### Scenario: Torneo fijo
- **WHEN** se intenta marcar como fijo un turno de torneo
- **THEN** el sistema no lo permite

### Requirement: Cada fecha es un turno normal
Cada fecha de un turno fijo SHALL comportarse como un turno común: se cobra, se edita y se cancela con las mismas reglas y políticas. El valor de cada fecha SHALL fijarse según los precios vigentes cuando esa fecha se reserva.

#### Scenario: Liberar una fecha suelta
- **WHEN** se cancela la fecha del lunes 26/10 de un turno fijo
- **THEN** esa fecha se libera con la política de cancelación habitual y el resto de las semanas sigue reservado

#### Scenario: Cobrar una fecha
- **WHEN** se cobra el turno fijo del lunes 19/10
- **THEN** el cobro corresponde solo a esa fecha

### Requirement: Dar de baja un turno fijo
El staff (y el profesor sobre sus propios fijos) SHALL poder dar de baja un turno fijo desde una fecha. A partir de esa fecha no se reservan más semanas y se liberan las fechas ya reservadas que no tengan cobros; las que tengan cobros SHALL quedar activas y el sistema SHALL indicarlas para gestionarlas a mano.

#### Scenario: Baja desde una fecha
- **WHEN** el admin da de baja desde el lunes 9/11 un fijo sin cobros adelantados
- **THEN** desde el 9/11 la cancha queda libre los lunes a las 09:00 y las fechas anteriores siguen reservadas

#### Scenario: Fecha con cobro
- **WHEN** se da de baja un fijo y el lunes 16/11 ya tiene una seña cobrada
- **THEN** el 16/11 queda activo y el sistema avisa que hay que cancelarlo a mano

### Requirement: Fijos en la planilla
Los turnos fijos SHALL verse reservados en cualquier fecha futura que se consulte en la planilla, en Hoy y en el buscador de disponibilidad, mientras no se los dé de baja.

#### Scenario: Consultar dentro de seis meses
- **WHEN** el operador abre la planilla de un lunes dentro de seis meses
- **THEN** el turno fijo de los lunes a las 09:00 aparece reservado
