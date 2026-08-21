## Purpose

Agrupa widgets informativos que anticipan reportes útiles para el club, como resúmenes para envío por WhatsApp y alertas de stock del kiosco.

## ADDED Requirements

### Requirement: Display report widgets
The system SHALL render a dashboard of report widgets on `/dashboard/reportes`.

#### Scenario: Reports page loaded
- **WHEN** the user opens `/dashboard/reportes`
- **THEN** the page shows widgets such as "Resumen diario", "Ocupación de canchas" and "Alertas de stock"

### Requirement: WhatsApp summary preview
The system SHALL provide a preview of a text summary that could be shared via WhatsApp.

#### Scenario: Share preview visible
- **WHEN** the user views the reports page
- **THEN** a card or section shows a pre-formatted summary with key daily figures

### Requirement: Stock alert widget
The system SHALL display a widget listing products with low stock.

#### Scenario: Low stock alerts
- **WHEN** the reports page is rendered
- **THEN** a widget lists products whose stock is below the threshold
