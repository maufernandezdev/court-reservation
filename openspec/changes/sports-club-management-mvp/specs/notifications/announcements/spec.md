## Purpose

Permite al operador del club redactar y visualizar avisos generales dirigidos a socios, como cancelaciones por lluvia o comunicaciones importantes.

## ADDED Requirements

### Requirement: Display announcement panel
The system SHALL render a panel on `/dashboard/notificaciones` for creating and viewing announcements.

#### Scenario: Notifications page loaded
- **WHEN** the user opens `/dashboard/notificaciones`
- **THEN** the page shows a form to compose a message and a list of recent announcements

### Requirement: Compose announcement
The system SHALL allow the user to enter a title and body for a new announcement.

#### Scenario: New announcement composed
- **WHEN** the user fills the title and body fields and submits the form
- **THEN** the announcement appears in the recent list with a timestamp

### Requirement: Announcement templates
The system SHOULD offer quick templates for common messages.

#### Scenario: Rain cancellation template
- **WHEN** the user selects a "Cancelación por lluvia" template
- **THEN** the form fields are pre-filled with a standard rain cancellation message
