## Purpose

Convierte la home del dashboard en un mapa de ocupación del club: muestra, para el momento actual, qué canchas están ocupadas (con titular y franja horaria) y cuáles disponibles, con posibilidad de filtrar por tipo de cancha.

## ADDED Requirements

### Requirement: Mostrar ocupación actual
The system SHALL show, for the authenticated user, every court of the club with its current status: occupied (showing the customer name and the time slot in progress) or available, based on the reservations stored for the current date and time.

#### Scenario: Cancha ocupada
- **WHEN** a court has a reservation in the current time slot for today
- **THEN** the occupancy view shows the court as occupied with the customer name and the slot (e.g., "18:00 – 19:00")

#### Scenario: Cancha disponible
- **WHEN** a court has no reservation in the current time slot
- **THEN** the occupancy view shows the court as available

#### Scenario: Todas las canchas de todos los tipos
- **WHEN** the user opens `/dashboard` without any filter
- **THEN** the view shows the occupancy of all the user's courts regardless of type

### Requirement: Filtrar ocupación por tipo
The system SHALL provide a type filter (options: all, fútbol, tenis, pádel) that restricts the occupancy view to courts of the selected type.

#### Scenario: Filtro por tipo
- **WHEN** the user selects a type (e.g., "Tenis") in the filter
- **THEN** only tennis courts are shown in the occupancy view

### Requirement: Estados de carga y vacío
The system SHALL show a loading indicator while courts/reservations load, and an empty state with a call to action when the user has no courts.

#### Scenario: Sin canchas
- **WHEN** the user has no courts and opens `/dashboard`
- **THEN** the view shows an empty state prompting to create the first court

### Requirement: Requiere autenticación
The system SHALL require authentication to view the occupancy map.

#### Scenario: Sin sesión
- **WHEN** an unauthenticated visitor opens `/dashboard`
- **THEN** the system redirects to the login page
