## Purpose

Ofrece una vista inicial de socios del club para consultar información básica de contacto y estado de cuota, preparando el terreno para futura gestión completa.

## ADDED Requirements

### Requirement: Display member list
The system SHALL render a list or table of club members with basic data.

#### Scenario: Members page loaded
- **WHEN** the user opens `/dashboard/socios`
- **THEN** the page shows a table with columns for name, DNI, phone and membership fee status

### Requirement: Show member status
The system SHALL visually indicate whether each member's fee is paid or pending.

#### Scenario: Fee status visible
- **WHEN** the member list is rendered
- **THEN** each row displays a badge or label for "Al día" or "Pendiente"

### Requirement: Search or filter members
The system SHOULD provide a basic text filter to search members by name.

#### Scenario: Filter by name
- **WHEN** the user types in the members search field
- **THEN** the list updates to show only members whose name contains the typed text
