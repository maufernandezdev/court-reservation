## Purpose

Permite a un operador del club acceder al sistema mediante credenciales locales hardcodeadas y mantiene una sesión simulada en el navegador para proteger las rutas privadas del dashboard.

## ADDED Requirements

### Requirement: Login with hardcoded credentials
The system SHALL authenticate a user when the provided username is `test` and the password is `123`.

#### Scenario: Successful login
- **WHEN** the user enters username `test` and password `123` on `/login` and submits the form
- **THEN** the system stores a simulated session flag in `localStorage` or a client-side cookie and redirects the user to `/dashboard`

### Requirement: Reject invalid credentials
The system SHALL reject any credentials other than the hardcoded pair and display an error message.

#### Scenario: Invalid username or password
- **WHEN** the user submits credentials that are not exactly `test` / `123`
- **THEN** the system shows an error alert or toast and remains on `/login` without storing a session

### Requirement: Protect private routes
The system SHALL redirect unauthenticated users away from `/dashboard` and its sub-routes.

#### Scenario: Unauthenticated access attempt
- **WHEN** a user without a valid session visits any `/dashboard/*` route
- **THEN** the system redirects the user to `/login`

### Requirement: Logout
The system SHALL allow an authenticated user to clear the session and return to the login page.

#### Scenario: User logs out
- **WHEN** the user clicks the logout button in the dashboard layout
- **THEN** the system removes the simulated session and redirects to `/login`
