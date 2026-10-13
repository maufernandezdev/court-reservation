## Purpose

Cobra más caros los turnos nocturnos (por el costo de la luz) con un precio de noche por tipo de cancha y un horario de inicio de la noche configurable para todo el club.

## ADDED Requirements

### Requirement: Precio de noche por tipo de cancha
Para cada tipo de cancha del club, el `admin` SHALL configurar en Precios, además de los precios de día, un precio por hora de noche para el público y otro para profes. Solo el `admin` SHALL modificarlos.

#### Scenario: Precios de día y de noche
- **WHEN** el admin configura tenis: día $10.000 (profe $7.000) y noche $12.000 (profe $9.000)
- **THEN** la tarjeta de Tenis muestra los cuatro valores y el resumen de un turno de día y de uno de noche

#### Scenario: Club que todavía no cargó el precio de noche
- **WHEN** se aplica el cambio en un club con precios de día ya cargados
- **THEN** el precio de noche arranca igual al de día, para que ningún turno nuevo cambie de valor hasta que el admin lo configure

### Requirement: Horario de inicio de la noche
El club SHALL tener un único horario a partir del cual rige el precio de noche, para todas las canchas y tipos de cancha. SHALL arrancar en 18:00 y el `admin` SHALL poder cambiarlo en Precios.

#### Scenario: Cambio de horario en verano
- **WHEN** el admin cambia el inicio de la noche a 19:00
- **THEN** un turno estándar de 18:00 a 19:00 se cotiza a precio de día y uno de 19:00, a precio de noche

### Requirement: Precio según la hora de inicio
El valor de un turno SHALL usar el precio de día si el turno empieza antes del horario de noche, y el precio de noche si empieza a esa hora o después, por toda su duración, aunque el turno cruce el horario. La regla SHALL aplicarse a turnos estándar, de profe (con los precios de profe), de torneo y a cada fecha de un turno fijo. El valor SHALL quedar fijado al reservar; en una edición SHALL recalcularse si cambian la cancha, el tipo, la duración o la hora de inicio.

#### Scenario: Turno que empieza de día
- **WHEN** se reserva un turno estándar de tenis de 17:30 a 18:30 con día $10.000 y noche $12.000 la hora
- **THEN** el turno vale $10.000

#### Scenario: Torneo que empieza de noche
- **WHEN** se reserva un torneo de tenis de 18:00 a 19:30
- **THEN** el turno vale $18.000 (90 minutos a precio de noche)

#### Scenario: Turno de profe nocturno
- **WHEN** un profe reserva pádel a las 20:00 con profe noche $5.000 la hora
- **THEN** el turno vale $5.000

#### Scenario: Mover un turno a la noche
- **WHEN** se edita un turno de 16:00 y se lo pasa a las 19:00
- **THEN** su valor se recalcula a precio de noche

#### Scenario: Turnos ya reservados
- **WHEN** el admin sube el precio de noche
- **THEN** los turnos ya reservados mantienen su valor

### Requirement: Valor visible según el horario
El formulario del turno, el buscador de disponibilidad y las tarjetas de Canchas SHALL mostrar el valor que corresponde al horario: el formulario y el buscador según la hora elegida; las tarjetas, el valor de día y el de noche.

#### Scenario: Buscador a la noche
- **WHEN** el operador busca canchas libres desde las 20:00
- **THEN** los resultados muestran el precio de noche
