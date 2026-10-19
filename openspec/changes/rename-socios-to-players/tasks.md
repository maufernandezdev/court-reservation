## 1. Base de datos

- [x] 1.1 Migración `0012_players_and_schema_cleanup.sql`: renombra `socios` → `players` (índices y políticas incluidos), `reservation_participants.socio_id` → `player_id`, la clave `socio_id` del JSON de `reservation_series.participants` y las filas `socio.*` de `audit_log`; redefine `ensure_series_until` con `player_id`; elimina `price_per_hour` y `deposit_*` de `courts`. Verificar en local que no queda ningún objeto con `socio` en el nombre (`\d`, `pg_policies`, `pg_indexes`, `pg_proc`)
- [x] 1.2 `supabase/rollback/0012_down.sql` (restaura nombres, la versión de `ensure_series_until` de 0008 y las columnas de `courts` con sus valores por defecto) y prueba subir → bajar → subir en local sin errores
- [x] 1.3 En local, crear un turno fijo con un jugador y consultar un mes adelante: las fechas generadas quedan vinculadas al jugador (`reservation_participants.player_id` no nulo)

## 2. Código

- [x] 2.1 Renombrar `lib/socios.ts` → `lib/players.ts`, `components/socios/` → `components/players/` y `app/dashboard/socios/` → `app/dashboard/jugadores/` (página, acciones y diálogo), con textos de UI en voseo ("Jugadores", "Agregar jugador") y verificar que `pnpm exec tsc --noEmit` pasa
- [x] 2.2 Cambiar `socio_id` por `player_id` y la tabla `socios` por `players` en `lib/reservations.ts`, `app/dashboard/reservas/actions.ts`, `components/reservations/people-combobox.tsx` y `reservation-form.tsx`; ajustar los mensajes de error ("Alguno de los jugadores ya no está disponible")
- [x] 2.3 `lib/audit.ts`: tipos `player.created|updated|removed` y sus textos ("dio de alta al jugador …"); menú en `components/shell/nav-config.ts` (ruta `/dashboard/jugadores`, etiqueta "Jugadores"); texto de Notificaciones y `lib/mocks/data.ts`; redirección `/dashboard/socios` → `/dashboard/jugadores` en `next.config.ts`
- [x] 2.4 Verificar que `grep -rIni socio app lib components hooks next.config.ts` no devuelve nada (salvo la redirección) y que `pnpm lint` y `pnpm build` pasan

## 3. Verificación y documentación

- [x] 3.1 Con el servidor local: alta, edición, búsqueda por nombre, DNI y teléfono, DNI repetido y baja de un jugador como admin y como operador; el profesor no ve la pantalla; el buscador de turnos ofrece jugadores; `/dashboard/socios` redirige
- [x] 3.2 Actualizar README y `docs/PROJECT_DOCUMENTATION.md` (tablas, rutas, nombres) y agregar la nota en `docs/next-steps.md`
- [x] 3.3 Aplicar `0012` en la base real con confirmación del usuario (`supabase db push --linked`) y verificar que `players` existe y `socios` no — aplicada el 2026-10-18 (`players` existe, `socios` no, 0 columnas muertas en `courts`)
