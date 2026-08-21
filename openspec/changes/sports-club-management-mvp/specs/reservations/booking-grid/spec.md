## Purpose

Permite visualizar y gestionar las reservas de canchas del club en una grilla interactiva donde las columnas representan canchas y las filas representan franjas horarias.

## ADDED Requirements

### Requirement: Display booking grid
The system SHALL render a grid with courts as columns, time slots as rows, and a selected date for which the schedule is shown.

#### Scenario: Grid rendered
- **WHEN** the user opens `/dashboard/reservas`
- **THEN** the page shows a table or grid with at least the configured courts (e.g., "Cancha 1 - Pádel", "Cancha 2 - Tenis", "Cancha 3 - Fútbol 7", "Cancha 4"), time slots starting from 09:00 in one-hour blocks, and the current date displayed as the active day

### Requirement: Navigate daily schedule
The system SHALL allow the user to move the schedule forward and backward one day at a time.

#### Scenario: Next day
- **WHEN** the user clicks the next-day control
- **THEN** the grid refreshes to show reservations for the day after the currently selected date

#### Scenario: Previous day
- **WHEN** the user clicks the previous-day control
- **THEN** the grid refreshes to show reservations for the day before the currently selected date

### Requirement: Jump to a specific date
The system SHALL allow the user to select a specific date to view its schedule.

#### Scenario: Date picker used
- **WHEN** the user selects a date through the date picker
- **THEN** the grid refreshes to show reservations for that date

### Requirement: Persist reservations per date
The system SHALL store each reservation tied to a specific date so changing days only shows reservations for the selected date.

#### Scenario: Creating reservation on another day
- **WHEN** the user creates a reservation on a day different from today
- **THEN** the reservation is stored for that date and is not visible when returning to today

### Requirement: Visualize occupancy
The system SHALL distinguish free cells from occupied cells and display the reservation holder on occupied cells.

#### Scenario: Existing reservations visible
- **WHEN** the grid contains reservations loaded from mock data
- **THEN** occupied cells show the customer name (e.g., "Fernández / Casimiro", "Torneo") and free cells appear as available

### Requirement: Open reservation dialog
The system SHALL open a dialog to create a reservation when the user clicks a free cell, and to view/edit an existing reservation when the user clicks an occupied cell.

#### Scenario: Click empty slot
- **WHEN** the user clicks a free cell in the grid
- **THEN** a shadcn/ui Dialog opens pre-filled with the selected court and time slot for creating a new reservation

#### Scenario: Click occupied slot
- **WHEN** the user clicks an occupied cell in the grid
- **THEN** a shadcn/ui Dialog opens showing the reservation details with editable fields

### Requirement: Edit reservation
The system SHALL allow the user to update the customer data of an existing reservation from the dialog.

#### Scenario: Save edited reservation
- **WHEN** the user modifies the customer name, phone/DNI, court, time or date and submits the dialog
- **THEN** the reservation is updated in the local state and the grid reflects the changes

### Requirement: Delete reservation
The system SHALL allow the user to delete an existing reservation after a confirmation step.

#### Scenario: Delete with confirmation
- **WHEN** the user clicks the delete action on an existing reservation
- **THEN** the system shows a confirmation prompt and only removes the reservation if the user confirms

### Requirement: Prevent double booking on edit
The system SHALL not allow editing a reservation into a slot that is already occupied by another reservation on the same date.

#### Scenario: Edit to occupied slot
- **WHEN** the user tries to save a reservation to a court/time/date already taken by a different reservation
- **THEN** the system prevents the save and shows an error message
