## Purpose

Permite a cada usuario gestionar las canchas de su club (fútbol, tenis, pádel), persistidas en Supabase y aisladas por usuario, para que luego alimenten las reservas y el resto del dashboard.

## ADDED Requirements

### Requirement: Crear cancha
The system SHALL allow an authenticated user to create a court with a name (required, non-empty) and a type (required, one of: fútbol, tenis, pádel). The system SHALL NOT impose a maximum number of courts per user.

#### Scenario: Creación exitosa
- **WHEN** the user submits the new-court form with a valid name and a selected type
- **THEN** the court is saved to Supabase associated with the authenticated user and appears in the user's court list

#### Scenario: Nombre vacío
- **WHEN** the user submits the form with an empty name
- **THEN** the system shows a validation error and does not save anything

#### Scenario: Tipo no seleccionado
- **WHEN** the user submits the form without selecting a type
- **THEN** the system shows a validation error and does not save anything

#### Scenario: Múltiples canchas
- **WHEN** the user already has one or more courts and creates another one
- **THEN** the new court is saved and listed alongside the existing ones

### Requirement: Listar canchas del usuario
The system SHALL display all courts belonging to the authenticated user in the Canchas section of the dashboard.

#### Scenario: Usuario con canchas
- **WHEN** an authenticated user with saved courts opens `/dashboard/canchas`
- **THEN** the page shows every court of that user with its name and type

#### Scenario: Estado vacío
- **WHEN** an authenticated user without any court opens `/dashboard/canchas`
- **THEN** the page shows an empty state with a call to action to create the first court

#### Scenario: Aislamiento entre usuarios
- **WHEN** two different users each have courts
- **THEN** each user only sees their own courts, never the other user's

### Requirement: Persistencia en Supabase
The system SHALL store each court as a row in the `courts` table with a reference to the owning user (`user_id` → `auth.users`), and SHALL enforce the isolation with Row Level Security policies so a user can only select and insert their own rows.

#### Scenario: Inserción con propietario
- **WHEN** a court is created
- **THEN** the row in `courts` carries the `user_id` of the authenticated user

#### Scenario: Lectura ajena bloqueada
- **WHEN** a query attempts to read courts of another user (directly against the table)
- **THEN** Row Level Security denies the read

### Requirement: Acceso autenticado
The system SHALL require authentication: unauthenticated visitors SHALL NOT be able to view or create courts.

#### Scenario: Sin sesión
- **WHEN** an unauthenticated visitor tries to open `/dashboard/canchas`
- **THEN** the system redirects to the login page
