> **Estado:** registrado (2026-10-06) como pendiente del rediseño `apply-saque-visual-design`. Sin specs, diseño ni tareas todavía.

## Why

El SRS (2.2) pide gestionar turnos fijos de profesores y grupos (clases, escuelitas, ligas) y evitar que se reserve "por las dudas" y se cancele en masa. El diseño ya reserva un tono propio ("Fijo / clase", color línea) en la planilla.

## What Changes

- Turnos recurrentes (semanal) asignados a un profesor o grupo, con abono en lugar de cobro por turno.
- Liberar una fecha suelta de un turno fijo, con las mismas reglas de ventana de cancelación.
- Alerta al admin cuando un turno fijo libera muchas fechas en el mes.
- Tono "fijo" en planilla, Hoy y detalle (ya existe en `lib/reservation-tone.ts`).

## Capabilities

### New Capabilities
- `fixed-reservations`: turnos recurrentes, liberación de fechas y alertas.

## Impact

Migración (serie recurrente + excepciones), planilla, Hoy, políticas, auditoría.
