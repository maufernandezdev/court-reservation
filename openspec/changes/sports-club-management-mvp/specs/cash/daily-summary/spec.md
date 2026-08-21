## Purpose

Presenta un resumen diario de ingresos del club para que el operador pueda consultar rápidamente la recaudación por concepto sin necesidad de backend.

## ADDED Requirements

### Requirement: Display daily income summary
The system SHALL show a summary of the day's income broken down by concept.

#### Scenario: Cash page loaded
- **WHEN** the user opens `/dashboard/caja`
- **THEN** the page displays total daily income and breakdown cards or rows for reservations, kiosk sales and other concepts

### Requirement: Show recent transactions
The system SHALL list the most recent transactions that contribute to the daily total.

#### Scenario: Recent transactions visible
- **WHEN** the cash page is rendered
- **THEN** a list shows recent entries with concept, amount and time

### Requirement: Reset daily view
The system SHOULD allow the user to select or refresh the date for which the summary is shown.

#### Scenario: Date selector used
- **WHEN** the user selects a different date
- **THEN** the summary updates to reflect mock data for that date
