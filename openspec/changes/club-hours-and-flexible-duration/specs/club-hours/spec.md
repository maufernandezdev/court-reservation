## Purpose

El horario de apertura y cierre es del club y no de cada cancha: se configura una vez y vale para todas.

## ADDED Requirements

### Requirement: Horario del club
El club SHALL tener un horario de apertura y de cierre, en pasos de 30 minutos, que arranca en 09:00–22:00. El `admin` SHALL poder cambiarlo en Políticas; el cierre SHALL ser posterior a la apertura. El cambio SHALL registrarse en Actividad. El horario SHALL aplicarse a todas las canchas: define los horarios en que se puede empezar un turno, el rango de la planilla y la ocupación de Hoy.

#### Scenario: Cambiar el horario
- **WHEN** el admin cambia el cierre a 23:30 en Políticas
- **THEN** la planilla muestra hasta las 23:30 y se pueden reservar turnos que terminen hasta esa hora

#### Scenario: Cierre anterior a la apertura
- **WHEN** el admin elige cierre 08:00 con apertura 09:00
- **THEN** el sistema no lo guarda e indica que el cierre debe ser posterior a la apertura

#### Scenario: Turnos fuera del nuevo horario
- **WHEN** el admin acorta el horario y existen turnos fuera de él
- **THEN** esos turnos no se borran y se siguen viendo, y los nuevos solo se aceptan dentro del horario

### Requirement: Horario en el alta del club
El modal de bienvenida del club recién creado SHALL incluir un paso para elegir el horario del club entre la bienvenida y los precios iniciales.

#### Scenario: Alta del club
- **WHEN** una persona termina de crear su club y toca "Siguiente" en la bienvenida
- **THEN** ve el horario del club (09:00–22:00 por defecto) y, con "Siguiente", los precios iniciales

### Requirement: Migración de clubes existentes
Al aplicar el cambio, el horario del club SHALL tomar la apertura más temprana y el cierre más tardío de sus canchas activas.

#### Scenario: Club con canchas de distinto horario
- **WHEN** un club tiene una cancha de 09:00 a 22:00 y otra de 10:00 a 23:00
- **THEN** su horario queda de 09:00 a 23:00
