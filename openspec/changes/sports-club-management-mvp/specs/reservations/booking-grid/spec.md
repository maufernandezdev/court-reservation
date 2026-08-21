## Purpose

Permite visualizar y gestionar las reservas de canchas del club en una grilla interactiva donde las columnas representan canchas y las filas representan franjas horarias.

## ADDED Requirements

### Requirement: Display booking grid
The system SHALL render a grid with courts as columns and time slots as rows.

#### Scenario: Grid rendered
- **WHEN** the user opens `/dashboard/reservas`
- **THEN** the page shows a table or grid with at least the configured courts (e.g., "Cancha 1 - Pádel", "Cancha 2 - Tenis", "Cancha 3 - Fútbol 7", "Cancha 4") and time slots starting from 09:00 in one-hour blocks

### Requirement: Visualize occupancy
The system SHALL distinguish free cells from occupied cells and display the reservation holder on occupied cells.

#### Scenario: Existing reservations visible
- **WHEN** the grid contains reservations loaded from mock data
- **THEN** occupied cells show the customer name (e.g., "Fernández / Casimiro", "Torneo") and free cells appear as available

### Requirement: Open reservation dialog
The system SHALL open a dialog to create a reservation when the user clicks a free cell.

#### Scenario: Click empty slot
- **WHEN** the user clicks a free cell in the grid
- **THEN** a shadcn/ui Dialog opens pre-filled with the selected court and time slot

### Requirement: Create reservation
The system SHALL allow the user to save a new reservation with customer data from the dialog.

#### Scenario: Save new reservation
- **WHEN** the user fills the customer name, phone/DNI, confirms the court and time, and submits the dialog
- **THEN** the reservation is added to the local state and the grid reflects the new occupied cell

### Requirement: Prevent double booking
The system SHALL not allow creating a reservation on an already occupied cell.

#### Scenario: Occupied cell clicked
- **WHEN** the user clicks an occupied cell
- **THEN** the system does not open the create dialog or clearly indicates the slot is already reserved
