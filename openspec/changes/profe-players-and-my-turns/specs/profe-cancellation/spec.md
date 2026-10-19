## Purpose

Que el profesor pueda cancelar sus propios turnos siempre, aceptando la penalidad cuando corresponde.

## ADDED Requirements

### Requirement: El profesor cancela sus turnos
El `profesor` SHALL poder cancelar cualquiera de sus propios turnos de profe, también dentro de la ventana de penalidad y cuando el turno tiene cobros registrados. NO SHALL poder cancelar turnos de otras personas. La cancelación en término SHALL aplicarse sin penalidad y liberar lo cobrado como saldo a favor. La cancelación fuera de término SHALL aplicar la penalidad de Políticas (porcentaje del valor del turno): se retiene de lo ya cobrado y lo que falta queda como deuda del teléfono del turno.

#### Scenario: En término
- **WHEN** un profesor cancela un turno propio con más horas de anticipación que la ventana
- **THEN** el turno queda cancelado sin penalidad

#### Scenario: Turno ajeno
- **WHEN** un profesor intenta cancelar un turno que no es suyo
- **THEN** el sistema lo rechaza

### Requirement: Aceptar la penalidad
Si la cancelación es fuera de término, el sistema SHALL mostrar al profesor, antes de confirmar, el monto de la penalidad, cuánto se descuenta de lo ya cobrado y cuánto queda a pagar, y SHALL exigir que acepte la penalidad. Sin aceptarla, la cancelación NO SHALL realizarse ni por la pantalla ni por la API.

#### Scenario: Fuera de término
- **WHEN** un profesor toca "Cancelar turno" de un turno de $8.000 que empieza en 3 horas, con penalidad del 25 %
- **THEN** el modal indica una penalidad de $2.000 y "Confirmar cancelación" queda deshabilitado hasta que marque que la acepta

#### Scenario: Con seña cobrada
- **WHEN** el turno tiene $1.000 cobrados y el profesor acepta la penalidad de $2.000
- **THEN** se descuentan los $1.000 cobrados y quedan $1.000 a pagar como deuda del turno

#### Scenario: Sin aceptar por la API
- **WHEN** se intenta cancelar fuera de término sin aceptar la penalidad
- **THEN** el sistema lo rechaza y el turno sigue activo

### Requirement: Leyenda de la planilla
La leyenda de la planilla SHALL mostrar "Señada" solo si algún deporte del club pide seña o hay turnos señados, y NO SHALL mostrar "Cancelada" (la planilla no muestra los turnos cancelados).

#### Scenario: Club sin seña
- **WHEN** ningún deporte pide seña y no hay turnos señados
- **THEN** la leyenda no incluye "Señada"
