# Proposal — add-club-operations-foundation

## Why

El SRS del cliente (`docs/requerimientos_software_canchas.md`) exige que el negocio pueda autogestionar sus canchas: precios, horarios, duraciones, señas, perfiles de usuario (admin/operador/profe), políticas de cancelación con penalidades, trazabilidad de acciones y una planilla usable desde el celular. Hoy el sistema solo permite ABM básico de canchas (nombre/tipo) y reservas de 1h sin dinero ni roles — el cliente no puede operar ni cobrar. La integración con Mercado Pago se **difiere explícitamente a una iteración posterior**; esta iteración entrega toda la lógica de negocio para que el club opere y registre cobros manualmente.

## What Changes

- **Gestión completa de canchas**: precio por hora, duración de turno configurable (30/60/90 min), horarios de apertura por cancha, y configuración de seña (toggle habilitar/deshabilitar, monto fijo o porcentaje). **BREAKING**: cambia el schema Zod de cancha y agrega columnas.
- **Roles y perfiles**: tabla `profiles` con `role` (`admin` | `operador` | `profesor`), invitación de miembros del club por el admin, enforcement vía RLS (operador no administra miembros/config; profesor no borra turnos fuera de política).
- **Políticas de cancelación**: configuración global de ventana de cancelación (horas de anticipación), esquema de penalidad (retener seña / % del valor), cancelación como soft-delete con motivo y estado (en término = libera seña / fuera de término = retiene), saldo a favor del cliente.
- **Registro de cobros manual**: estados de pago de la reserva (`pendiente` | `señada` | `pagada`) marcables manualmente desde la planilla, para operar sin MP hasta su integración.
- **Auditoría**: `created_by`, `updated_by`, `cancelled_by` en reservas + tabla `audit_log` de acciones relevantes (crear/modificar/cancelar/cobrar).
- **Planilla mobile-first**: grilla de reservas rediseñada para celular (vista por cancha en mobile, grid en desktop) + buscador rápido de disponibilidad por fecha/franja/tipo.

## Capabilities

### New Capabilities
- `court-pricing-and-schedules`: configuración de precios, duración de turno, horarios de apertura y seña por cancha.
- `club-roles`: perfiles con roles (admin/operador/profesor), invitación de miembros y enforcement de permisos.
- `cancellation-policies`: políticas de anulación configurables, penalidades, saldo a favor y restricciones para profesores.
- `reservation-payments`: estados de pago de la reserva y registro manual de señas/cobros (base para Mercado Pago futuro).
- `reservation-audit`: trazabilidad de quién creó, modificó, cobró o canceló cada reserva.
- `mobile-reservations-experience`: planilla responsive mobile-first y buscador rápido de disponibilidad.

### Modified Capabilities
- `reservations`: la reserva pasa a tener duración variable, estado, pago y cancelación lógica en lugar de borrado físico (delta en `openspec/changes/*/specs` existentes si aplica; `openspec/specs/` aún está vacío, se captura como capacidad nueva arriba y en los deltas de este change).

## Impact

- **DB (Supabase)**: nuevas migraciones — `profiles`, columnas en `courts` (precio, duración, horario, seña), columnas en `reservations` (estado, duración, pago, audit, cancelación), tablas `cancellation_policies` (o settings), `credit_balances` (saldo a favor), `audit_log`, `memberships`. Nuevas policies RLS por rol.
- **App**: `app/dashboard/canchas` (formulario extendido), nueva página `app/dashboard/configuracion` (políticas de cancelación), `app/dashboard/miembros` (gestión de perfiles), redesign de `app/dashboard/reservas` (mobile-first + buscador + flujos de cancelación/cobro).
- **Hooks/lib**: `use-reservations`, `use-courts` refactor; `lib/roles.ts`, `lib/availability.ts`.
- **Sin nuevas dependencias** de pago en esta iteración (sin SDK de Mercado Pago).
- **Backward compatibility**: migraciones deben poblar defaults (duración 60min, seña deshabilitada, rol admin para el dueño existente) para no romper datos actuales.
