## Why

"Socio" sugiere alguien que paga una cuota, y el club donde se empieza no tiene cuotas: la tabla guarda en realidad a las personas que juegan, sean socias o no. Además `members` (su traducción natural) chocaría con `memberships`, que son los roles del equipo. Hoy la base está vacía y no hay datos que migrar, así que es el momento más barato para renombrar y sacar de paso lo que quedó de más en el esquema.

## What Changes

- **BREAKING (nombres)**: la tabla `socios` pasa a `players` (en la UI, "Jugadores"). La ruta `/dashboard/socios` pasa a `/dashboard/jugadores`, y se renombran `lib/socios.ts`, `components/socios/`, las acciones, el ítem del menú, los textos de la UI y las entradas de auditoría nuevas.
- `reservation_participants.socio_id` pasa a `player_id` (con su índice y la FK a `players`).
- El campo `socio_id` del JSON `reservation_series.participants` pasa a `player_id`.
- Se renombran los índices y políticas de `socios` (`socios_*` → `players_*`).
- Se eliminan de `courts` las columnas `price_per_hour`, `deposit_enabled`, `deposit_type` y `deposit_value`: los precios y la seña viven en `sport_prices` desde la migración 0008 y ninguna pantalla ni función las usa (solo el backfill de 0008).
- Migración `0012_players_and_schema_cleanup.sql` con su `supabase/rollback/0012_down.sql`.
- `memberships`, `profiles`, `settings`, `credit_balances` y `audit_log` no cambian.
- Se actualizan README y `docs/PROJECT_DOCUMENTATION.md`, y se deja una nota en `docs/next-steps.md`.

## Capabilities

### New Capabilities
- `club-players`: alta, edición, baja y búsqueda de jugadores del club. Reemplaza a `club-socios` (mismo comportamiento, nombre nuevo, sin cuota).

### Modified Capabilities

## Impact

- Base: migración 0012 (renombres y 4 columnas eliminadas de `courts`). No hay datos que migrar: la base se vació el 2026-10-18.
- Código: `app/dashboard/socios/` → `app/dashboard/jugadores/`, `lib/socios.ts`, `components/socios/`, `components/reservations/people-combobox.tsx`, `reservation-form.tsx`, `app/dashboard/reservas/actions.ts`, `lib/reservations.ts`, `lib/audit.ts`, `components/shell/nav-config.ts`, `lib/mocks/data.ts` y la página de Notificaciones (texto).
- Los cambios de OpenSpec anteriores (`add-reservation-types-and-socios`) quedan como historial y no se reescriben.
- Un enlace guardado a `/dashboard/socios` dejaría de andar: se agrega una redirección a `/dashboard/jugadores`.
