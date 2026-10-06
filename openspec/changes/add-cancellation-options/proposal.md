> **Estado:** registrado (2026-10-06) como pendiente del rediseño `apply-saque-visual-design`. Sin specs, diseño ni tareas todavía.

## Why

Hoy toda cancelación aplica la política al jugador y lo cobrado en término siempre va a saldo a favor. En la operación real, el club cancela por lluvia, mantenimiento o corte de luz (no corresponde penalidad) y algunos clubes prefieren devolver la seña. El canvas incluye "¿Quién cancela?" en la cancelación y la opción "la seña se devuelve" en Políticas.

## What Changes

- Al cancelar: elegir si cancela el jugador (aplica la política) o el club (sin penalidad, todo a saldo a favor o devolución), con motivo.
- En Políticas: elegir si en término la seña queda como saldo a favor o se devuelve (el operador registra la devolución en caja).
- Auditoría con quién canceló y el motivo.

## Capabilities

### Modified Capabilities
- `cancellation-policies`: cancelación por el club y modo de devolución.

## Impact

`cancelReservationAction`, `lib/cancellation.ts` (mantener en sync), `settings`, panel de detalle, Políticas, Actividad.
