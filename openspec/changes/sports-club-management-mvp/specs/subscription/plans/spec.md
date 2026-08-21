## Purpose

Muestra los planes de suscripción disponibles para el club dentro del SaaS, incluyendo la prueba gratis, el plan básico y el plan pro por volumen.

## ADDED Requirements

### Requirement: Display subscription plans
The system SHALL render a pricing page on `/dashboard/suscripcion` showing the available SaaS plans for the club.

#### Scenario: Subscription page loaded
- **WHEN** the user opens `/dashboard/suscripcion`
- **THEN** the page shows cards for "Prueba gratis 30 días", "Plan Básico" and "Plan Pro por volumen" with price, features and call-to-action

### Requirement: Highlight current plan
The system SHALL indicate which plan is currently active for the club.

#### Scenario: Active plan visible
- **WHEN** the subscription page is rendered
- **THEN** the active plan card is visually highlighted and labeled as "Plan actual"

### Requirement: Plan feature comparison
The system SHALL list the main features included in each plan.

#### Scenario: Features listed
- **WHEN** the user views a plan card
- **THEN** a list of included features is visible (e.g., number of courts, users, reports)
