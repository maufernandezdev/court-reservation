## Purpose

Brinda trazabilidad completa de las acciones sobre reservas: quién creó, modificó, cobró o canceló cada turno, en qué momento y con qué cambios relevantes.

## ADDED Requirements

### Requirement: Identidad en las reservas
Cada reserva SHALL registrar el usuario que la creó, el último usuario que la modificó y, si fue cancelada, el usuario que canceló junto con fecha y hora de cada evento.

#### Scenario: Creación de reserva
- **WHEN** un operador crea una reserva
- **THEN** la reserva queda con `created_by` y `updated_by` apuntando a ese operador

#### Scenario: Cancelación registrada
- **WHEN** se cancela una reserva
- **THEN** queda registrado quién la canceló y en qué momento, además del motivo si fue informado

### Requirement: Log de acciones relevantes
El sistema SHALL mantener un registro de auditoría append-only con las acciones relevantes sobre reservas (creación, modificación, cobro, cancelación, aplicación de saldo a favor), incluyendo actor, timestamp y datos esenciales de la acción.

#### Scenario: Cobro auditado
- **WHEN** se registra un cobro sobre una reserva
- **THEN** el log de auditoría contiene una entrada con el actor, la reserva y el monto cobrado

### Requirement: Auditoría visible para admin
El `admin` SHALL poder consultar el historial de acciones de una reserva desde la interfaz, y el personal operativo SHALL ver al menos el autor de la última modificación en la planilla.

#### Scenario: Detalle de reserva
- **WHEN** el admin abre el detalle de una reserva
- **THEN** ve el historial de acciones con actor y hora de cada una
