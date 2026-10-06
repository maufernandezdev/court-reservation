> **Estado:** registrado (2026-10-06) como pendiente del rediseño `apply-saque-visual-design`. Sin specs, diseño ni tareas todavía.

## Why

El SRS (1.1) pide que jugadores y alumnos vean disponibilidad y reserven solos, pagando la seña o el total con Mercado Pago, sin que el personal tenga que estar en el club. Es lo que más diferencia al producto para venderlo. El modelo ya tiene `payments.external_ref` preparado.

## What Changes

- Página pública por club con disponibilidad en tiempo real y reserva.
- Cobro de seña o total con Mercado Pago (Checkout Pro primero, sandbox), confirmación por webhook.
- Aplicación de las políticas de cancelación también para reservas online.

## Capabilities

### New Capabilities
- `public-booking`: disponibilidad pública y reserva online.
- `online-payments`: integración con Mercado Pago.

## Impact

Rutas públicas, RLS para lectura pública acotada, webhook (API Route), `payments`, diseño de las pantallas públicas (no están en el canvas actual).
