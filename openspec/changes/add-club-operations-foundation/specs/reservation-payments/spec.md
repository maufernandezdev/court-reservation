## Purpose

Permite registrar el estado de pago de cada reserva (pendiente, señada o pagada) y los cobros manuales de seña o total realizados en el club, dejando el modelo listo para la futura integración con Mercado Pago.

## ADDED Requirements

### Requirement: Estados de pago de la reserva
Cada reserva SHALL tener un estado de pago: `pendiente` (sin cobros), `senada` (seña cobrada) o `pagada` (total cobrado). El estado SHALL derivarse de los cobros registrados sobre la reserva.

#### Scenario: Nueva reserva
- **WHEN** se crea una reserva en una cancha con seña habilitada
- **THEN** la reserva queda en estado `pendiente` con el monto de seña calculado visible

#### Scenario: Registro de seña manual
- **WHEN** el operador registra el cobro de la seña de una reserva
- **THEN** la reserva pasa a estado `senada` y el cobro queda registrado con monto, fecha y usuario

#### Scenario: Registro de pago total
- **WHEN** el operador registra el cobro del valor total del turno
- **THEN** la reserva pasa a estado `pagada`; si existía una seña, queda imputada como parte del pago

### Requirement: Montos calculados sobre la configuración de la cancha
El valor del turno SHALL calcularse a partir del precio por hora y la duración de la cancha. El monto de seña SHALL calcularse según la configuración de seña (monto fijo o porcentaje) vigente al crear la reserva.

#### Scenario: Turno de 90 minutos
- **WHEN** una cancha cuesta $8.000/hora y el turno es de 90 minutos
- **THEN** el valor del turno es $12.000 y una seña del 50% es de $6.000

### Requirement: Preparación para pasarela externa
Los cobros registrados SHALL guardarse en una tabla de pagos con referencia externa opcional, de modo que la futura integración con Mercado Pago pueda vincular pagos confirmados por webhook sin cambios estructurales.

#### Scenario: Pago con referencia externa
- **WHEN** un cobro se registra con una referencia externa (p. ej. id de pago de pasarela)
- **THEN** el cobro queda vinculado a esa referencia y es consultable
