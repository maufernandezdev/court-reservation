## MODIFIED Requirements

### Requirement: Visualize occupancy
The system SHALL distinguish free cells from occupied cells and display the reservation holder on occupied cells, loading reservations for the selected date from Supabase.

#### Scenario: Existing reservations visible
- **WHEN** the grid shows reservations loaded from Supabase for the selected date
- **THEN** occupied cells show the customer name (e.g., "Fernández / Casimiro", "Torneo") and free cells appear as available

### Requirement: Edit reservation
The system SHALL allow the user to update an existing reservation from the dialog, persisting the change to Supabase.

#### Scenario: Save edited reservation
- **WHEN** the user modifies the customer name, phone/DNI, court, time or date and submits the dialog
- **THEN** the reservation is updated in Supabase and the grid reflects the changes

### Requirement: Delete reservation
The system SHALL allow the user to delete an existing reservation after a confirmation step, removing it from Supabase.

#### Scenario: Delete with confirmation
- **WHEN** the user clicks the delete action on an existing reservation
- **THEN** the system shows a confirmation prompt and only removes the reservation from Supabase if the user confirms

### Requirement: Persist reservations per date
The system SHALL store each reservation in Supabase tied to a specific date, the owning user and a court, so changing days only shows reservations for the selected date.

#### Scenario: Creating reservation on another day
- **WHEN** the user creates a reservation on a day different from today
- **THEN** the reservation is stored for that date and is not visible when returning to today
