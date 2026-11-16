> **Origen:** etapa 1 aprobada por Mau (2026-11-15). El club arma torneos con una persona que organiza los partidos pero no maneja la plata; en la planilla de papel los partidos de torneo se anotan "A vs B" con el marcador ("6-2 6-3").

## Why

Hoy un torneo lo carga el admin o el operador. La persona que organiza el torneo necesita ver toda la planilla, armar y mover los partidos y anotar resultados, sin ver montos ni tocar cobros. Además el club cobra los torneos a otro precio que el alquiler común.

## What Changes

- **Rol `organizador` ("Organizador de torneos"):** se invita desde Equipo. Ve toda la planilla, crea, mueve y cancela turnos de torneo (cancelación con las reglas del profe: en término y sin cobros), carga jugadores y resultados. No ve montos en ningún lado (planilla, detalle, Hoy, buscador) ni entra a Caja, Reportes, Canchas, Equipo, Políticas o Actividad; no cobra.
- **Montos ocultos en el servidor:** `reservations`, `payments`, `sport_prices`, `credit_balances` y `audit_log` dejan de ser legibles para el organizador (`sees_money`). La app lee los turnos de la vista `reservation_board`, con `price` en null para él. Sus escrituras pasan por las Server Actions, que validan rol y reglas, revisan el solo lectura por suscripción y escriben con el cliente del servidor; lo que vuelve al navegador va sin precio.
- **Resultado de los partidos:** `result_winner` (lado 1 o 2) y `result_score` ("6-4 3-6 10-8") en turnos de torneo; los cargan admin, operador y organizador desde el detalle. En la planilla, un tilde y el marcador.
- **Precio de torneo:** `sport_prices.torneo_price_per_hour` y `torneo_night_price_per_hour` (iniciados con el precio del público), en el modal de Precios junto a Público y Profe. Los torneos nuevos usan ese precio según día o noche; los ya reservados no cambian. Las listas de precios están en `PRICE_LISTS` / `PRICE_LIST_BY_KIND`, así sumar "americano" es una columna y una entrada.
- **Turnos fijos:** `ensure_series_until` no genera fechas cuando lo llama un organizador (no puede revisar choques sin leer `reservations`).

## Capabilities

### New Capabilities
- `tournament-organizer`: rol, ocultamiento de montos y resultados de torneo.

### Modified Capabilities
- `sport-pricing`: lista de precios de torneo.

## Impact

- **Base de datos:** `0026_tournament_organizer.sql` (rol, `is_organizer`, `sees_money`, políticas de lectura, vista `reservation_board`, columnas de resultado y de precio de torneo) y `0027_series_skip_organizer.sql`, con sus rollbacks.
- **Código:** `lib/roles.ts` (rol, `canSeeMoney`, matriz), `lib/members.ts`, `lib/reservations.ts` (`RESERVATION_SOURCE`, `canManageReservation`, `matchResultSchema`), `lib/pricing.ts`, `lib/reservation-tone.ts`, acciones de turnos (`forRole`, `forClient`, `setMatchResultAction`), formulario, detalle, Hoy, buscador, planilla, Precios y Equipo.
- **Fuera de alcance:** cuadros o fixture del torneo, inscripciones, modalidad americano visible.
