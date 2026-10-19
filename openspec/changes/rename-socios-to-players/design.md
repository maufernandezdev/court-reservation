## Context

`socios` se creó en la migración 0008 (ver `add-reservation-types-and-socios`). Se usa en tres lugares de la base: la propia tabla (con índices y políticas), `reservation_participants.socio_id` y el campo `socio_id` dentro del JSON `reservation_series.participants`, que lee la función `ensure_series_until` al generar fechas de un turno fijo. En el código lo usan el listado y el alta, el buscador de personas del formulario de turnos, la validación de `prepareReservation`, la auditoría y el menú.

Las columnas `courts.price_per_hour` y `courts.deposit_*` (migración 0005) quedaron sin uso cuando los precios pasaron a `sport_prices` (0008): ninguna pantalla, acción ni función las lee; solo el backfill de 0008 las usó una vez.

La base quedó vacía el 2026-10-18, así que no hay datos que conservar. Motivación: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Que el nombre `players` / "Jugadores" sea el único que queda, en base, código y UI.
- Que el esquema no tenga columnas sin dueño.
- Que la migración se pueda deshacer.

**Non-Goals:**
- Cambiar qué guarda un jugador o quién lo gestiona.
- Cambiar `memberships`, `profiles`, `settings`, `credit_balances` o `audit_log`.
- Reescribir los cambios de OpenSpec ya hechos (quedan como historial).

## Decisions

- **`alter table ... rename`, no tabla nueva.** Conserva políticas, índices y FKs sin recrearlos; con la base vacía igual daría lo mismo, pero el rename es más corto y reversible. Se renombran a mano los índices (`socios_club_dni_idx` → `players_club_dni_idx`, `socios_club_name_idx` → `players_club_name_idx`, `reservation_participants_socio_idx` → `reservation_participants_player_idx`) y las políticas (`socios_*` → `players_*`) para que no quede ningún `socio` en el catálogo.
- **`ensure_series_until` se redefine con `create or replace`** leyendo `player_id` del JSON. Si se renombrara el campo sin redefinir la función, las fechas nuevas de un turno fijo perderían el vínculo con el jugador sin dar error. Para el rollback se restaura la versión de 0008.
- **Campo JSON renombrado en los datos existentes** con un `update ... set participants = ...` que reemplaza la clave `socio_id` por `player_id`. Hoy no hay filas, pero queda correcto si se aplica sobre una base con datos (la migración es independiente del vaciado).
- **Columnas de `courts` con `drop column`**, no `deprecated`. No hay lectores; dejar columnas muertas confunde (ya hay precios en dos lugares).
- **Auditoría: tipos nuevos `player.created|updated|removed`.** Las filas viejas con `socio.*` se renombran en la migración (`update audit_log set action = replace(action, 'socio.', 'player.')`), así el historial se sigue leyendo y no hace falta mantener ambos nombres en `lib/audit.ts`.
- **Ruta nueva con redirección.** `/dashboard/jugadores` es la pantalla; `/dashboard/socios` queda como `redirect` en `next.config.ts` para no romper enlaces guardados.
- **Una migración, un archivo `0012`.** El número 0010 sigue reservado para `add-night-pricing`, que aún no se aplicó.

Alternativas descartadas: `clients` (suena más a negocio que a club) y `people` (ya se usa "personas" para quienes figuran en un turno sin estar registrados).

## Risks / Trade-offs

- [Renombrar la clave del JSON y olvidar la función] → la función se redefine en la misma migración, y la verificación incluye crear un fijo con jugador y consultar un mes adelante.
- [Código que sigue usando `socios` pasa los tipos pero falla en ejecución] → `grep -ri socio` sobre `app lib components hooks` debe dar cero resultados (salvo los comentarios históricos), y se prueba el alta, la búsqueda y la baja en local.
- [Rollback sobre una base con datos] → el `down` revierte renombres y vuelve a agregar las columnas de `courts` con sus valores por defecto; los precios que tenían se pierden (ya estaban en `sport_prices`).

## Migration Plan

1. Escribir `0012_players_and_schema_cleanup.sql` y `supabase/rollback/0012_down.sql`.
2. Probar subir → bajar → subir contra el Supabase local.
3. Aplicar en la base real con confirmación del usuario (`supabase db push --linked`); la base está vacía, así que no hay riesgo sobre datos.
4. Desplegar el código nuevo junto con la migración: el código viejo no encuentra la tabla `socios`.
