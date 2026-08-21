## Purpose

Permite visualizar el stock de productos del kiosco del club e incluye un placeholder para futura integración con lectura de código de barras.

## ADDED Requirements

### Requirement: Display product stock table
The system SHALL render a table of kiosk products with category, quantity and price information.

#### Scenario: Products page loaded
- **WHEN** the user opens `/dashboard/productos`
- **THEN** the page shows a table with product name, category (drinks, balls, paddle rental, etc.), stock quantity and unit price

### Requirement: Visual stock alerts
The system SHALL highlight products with low or zero stock.

#### Scenario: Low stock visible
- **WHEN** a product has stock below a defined threshold
- **THEN** the row shows a visual warning (e.g., badge or row highlight)

### Requirement: Barcode scanner placeholder
The system SHALL display a barcode scanner placeholder to signal future integration.

#### Scenario: Barcode area rendered
- **WHEN** the products page is loaded
- **THEN** an input or button labeled for barcode scanning is visible, even if it only simulates the action
