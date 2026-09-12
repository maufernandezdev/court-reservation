## Purpose

Permite a cada usuario persistir las reservas de sus canchas (titular, fecha y franja horaria) en Supabase, con aislamiento por usuario e integridad de un solo titular por cancha, fecha y hora.

## ADDED Requirements

### Requirement: Crear reserva
The system SHALL allow an authenticated user to create a reservation linked to one of their own courts, with a date, a time slot and a customer name (required, non-empty). The phone is optional.

#### Scenario: Creación exitosa
- **WHEN** the user submits the reservation dialog with a valid court, date, time and customer name
- **THEN** the reservation is stored in Supabase linked to the user and the court, and appears on the grid for that date

#### Scenario: Titular vacío
- **WHEN** the user submits the reservation with an empty customer name
- **THEN** the system shows a validation error and nothing is saved

#### Scenario: Cancha de otro usuario
- **WHEN** a reservation references a court that does not belong to the authenticated user
- **THEN** the system rejects the operation

### Requirement: Listar reservas por fecha
The system SHALL provide the authenticated user's reservations for a given date, so the grid shows only the reservations of the selected day.

#### Scenario: Reservas del día seleccionado
- **WHEN** the user navigates to a date in the grid
- **THEN** only the reservations stored for that date are shown

### Requirement: Editar reserva
The system SHALL allow the user to update an existing reservation's customer data, court, date or time, persisting the change in Supabase.

#### Scenario: Guardar edición
- **WHEN** the user modifies a reservation in the dialog and submits
- **THEN** the change is persisted and the grid reflects it

### Requirement: Eliminar reserva
The system SHALL allow the user to delete an existing reservation after a confirmation step, removing it from Supabase.

#### Scenario: Eliminar con confirmación
- **WHEN** the user confirms the deletion of a reservation
- **THEN** the reservation is removed from Supabase and disappears from the grid

### Requirement: Prevenir doble reserva
The system SHALL NOT allow two reservations on the same court, date and time slot, both on create and on edit, and SHALL show an error message when it happens.

#### Scenario: Slot ya ocupado
- **WHEN** the user tries to save a reservation on a court/date/time already taken
- **THEN** the save is rejected and the system shows an error message

### Requirement: Aislamiento y autenticación
The system SHALL enforce with Row Level Security that a user can only select, insert, update and delete their own reservations, and unauthenticated access SHALL be denied.

#### Scenario: Sin sesión
- **WHEN** an unauthenticated client queries the reservations table
- **THEN** no rows are returned and writes are rejected

#### Scenario: Reserva ajena
- **WHEN** a user attempts to read or modify another user's reservation
- **THEN** the operation is denied by RLS
