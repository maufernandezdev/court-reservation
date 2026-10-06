## Purpose

Define reglas de anulación configurables para el club: ventana de cancelación, penalidades por cancelación tardía y saldo a favor, incluyendo restricciones específicas para turnos de profesores, reemplazando el borrado directo actual.

## ADDED Requirements

### Requirement: Ventana de cancelación configurable
El sistema SHALL permitir al `admin` configurar las horas de anticipación mínima para cancelar en término (por defecto 24 horas). La política SHALL aplicarse sobre la fecha y hora de inicio del turno.

#### Scenario: Configuración por defecto
- **WHEN** el club aún no configuró la política
- **THEN** la ventana de cancelación en término es de 24 horas

### Requirement: Cancelación en término
El sistema SHALL permitir cancelar sin penalidad cuando resta más tiempo que la ventana configurada. Si el turno tenía una seña registrada como cobrada, la cancelación en término SHALL liberarla (marcarla como devuelta/liberada).

#### Scenario: Cancelación 48hs antes con seña cobrada
- **WHEN** se cancela un turno con seña cobrada 48 horas antes de su inicio y la ventana es de 24 horas
- **THEN** la reserva queda cancelada, la seña se marca como liberada y no se genera penalidad

### Requirement: Cancelación tardía con penalidad
El sistema SHALL aplicar penalidad cuando la cancelación ocurre dentro de la ventana: SHALL retener la seña cobrada, o —si no hubo seña cobrada— SHALL registrar una deuda/penalidad por el porcentaje configurado del valor del turno (por defecto 50%).

#### Scenario: Cancelación tardía con seña cobrada
- **WHEN** se cancela un turno con seña cobrada 1 hora antes de su inicio
- **THEN** la seña queda retenida como penalidad y la reserva se marca cancelada fuera de término

#### Scenario: Cancelación tardía sin seña
- **WHEN** se cancela fuera de término un turno sin seña cobrada, valor $10.000 y penalidad 50%
- **THEN** queda registrada una deuda de $5.000 a nombre del cliente

### Requirement: Saldo a favor del cliente
El sistema SHALL mantener un saldo a favor por cliente (identificado por teléfono) y SHALL permitir aplicarlo como parte de pago en reservas futuras.

#### Scenario: Aplicar saldo a favor
- **WHEN** un cliente con saldo a favor de $3.000 reserva un turno y se aplica su saldo
- **THEN** el saldo se descuenta del monto a pagar y su saldo queda en $0

### Requirement: Restricción de borrado para profesores
El sistema SHALL impedir que usuarios con rol `profesor` cancelen turnos dentro de la ventana de penalidad; solo el `admin` (o `operador` si la política lo habilita) SHALL poder hacerlo.

#### Scenario: Profesor cancela dentro de la ventana
- **WHEN** un profesor intenta cancelar un turno que inicia dentro de la ventana de penalidad
- **THEN** el sistema rechaza la acción e informa que debe gestionarlo un administrador

#### Scenario: Admin cancela dentro de la ventana
- **WHEN** el admin cancela un turno dentro de la ventana de penalidad
- **THEN** el sistema aplica la penalidad correspondiente y registra la cancelación a nombre del admin

### Requirement: Cancelación lógica con trazabilidad
Las reservas canceladas NO SHALL eliminarse físicamente: SHALL conservarse con estado `cancelada`, motivo opcional, marca de cancelación fuera de término y usuario que canceló.

#### Scenario: Historial preservado
- **WHEN** se cancela una reserva
- **THEN** la reserva deja de ocupar el turno en la planilla pero sigue siendo consultable con sus datos de cancelación
