## Purpose

Provee un shell de navegación consistente para todas las secciones del dashboard, identificando el club actual y permitiendo al usuario moverse entre módulos o cerrar sesión.

## ADDED Requirements

### Requirement: Display club identity
The system SHALL display the club name and a recognizable brand area inside the dashboard shell.

#### Scenario: Dashboard loaded
- **WHEN** an authenticated user lands on any `/dashboard/*` page
- **THEN** the layout shows "Club Deportivo Central" or the configured club name

### Requirement: Navigation links
The system SHALL render navigation links to all dashboard modules described in the MVP.

#### Scenario: Sidebar or header visible
- **WHEN** the dashboard layout is rendered
- **THEN** it includes links to `/dashboard/reservas`, `/dashboard/socios`, `/dashboard/productos`, `/dashboard/caja`, `/dashboard/reportes`, `/dashboard/notificaciones` and `/dashboard/suscripcion`

### Requirement: Highlight active route
The system SHALL visually indicate which navigation link corresponds to the current route.

#### Scenario: User navigates to a module
- **WHEN** the URL matches one of the dashboard module routes
- **THEN** the corresponding navigation item is highlighted

### Requirement: Logout action
The system SHALL include a logout control inside the dashboard layout.

#### Scenario: Logout button present
- **WHEN** the dashboard layout is rendered
- **THEN** a "Cerrar sesión" button is available and triggers the auth logout flow
