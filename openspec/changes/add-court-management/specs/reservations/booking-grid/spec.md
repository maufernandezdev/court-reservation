## MODIFIED Requirements

### Requirement: Display booking grid
The system SHALL render a grid with the authenticated user's real courts (loaded from Supabase) as columns, time slots as rows, and a selected date for which the schedule is shown.

#### Scenario: Grid rendered
- **WHEN** the user opens `/dashboard/reservas`
- **THEN** the page shows a table or grid with the user's courts loaded from Supabase as columns, time slots starting from 09:00 in one-hour blocks, and the current date displayed as the active day

#### Scenario: Courts loading
- **WHEN** the courts are being loaded from Supabase
- **THEN** the page shows a loading indicator instead of the grid

#### Scenario: No courts yet
- **WHEN** the user has no courts and opens `/dashboard/reservas`
- **THEN** the page shows an empty state with a call to action to create courts in the Canchas section

## ADDED Requirements

### Requirement: Filter courts by type
The system SHALL provide a type filter in the booking grid (options: all, fútbol, tenis, pádel) that restricts the grid columns to courts of the selected type.

#### Scenario: Filter by a type
- **WHEN** the user selects a specific type (e.g., "Pádel") in the filter
- **THEN** the grid only shows columns for courts of that type

#### Scenario: Show all types
- **WHEN** the user selects "Todas" (or no filter is applied)
- **THEN** the grid shows columns for all of the user's courts regardless of type
