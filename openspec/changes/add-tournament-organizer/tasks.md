## 1. Base de datos

- [x] 1.1 `0026_tournament_organizer.sql` y `supabase/rollback/0026_down.sql`: rol `organizador` en membresías e invitaciones, `is_organizer` / `sees_money`, lectura de tablas con plata cerrada al organizador, vista `reservation_board`, resultado de torneo y precio de torneo (backfill = público)
- [x] 1.2 `0027_series_skip_organizer.sql` y su rollback: el organizador no genera fechas de turnos fijos
- [x] 1.3 Aplicar en la base real — aplicadas el 2026-11-15 en `ddzxywqtnmibrctevmew`; verificado que la vista embebe las personas del turno

## 2. Rol y permisos

- [x] 2.1 Rol, etiqueta "Organizador de torneos", invitable desde Equipo, matriz de permisos y menú (sin Caja, Reportes, Canchas, Equipo, Políticas ni Actividad)
- [x] 2.2 Lecturas de turnos desde `reservation_board` (planilla, Hoy, formulario, buscador)
- [x] 2.3 Acciones: el organizador crea y edita solo torneos, cancela en término y sin cobros, escribe con el cliente del servidor tras validar y revisar el solo lectura; las respuestas van sin precio
- [x] 2.4 Sin montos en planilla, detalle, Hoy, buscador y formulario

## 3. Resultados y precio de torneo

- [x] 3.1 `setMatchResultAction` (admin, operador, organizador) con auditoría; formulario en el detalle; tilde y marcador en la planilla
- [x] 3.2 Precio de torneo de día y de noche en Precios; `quotePrice` usa la lista de torneo (sin precio propio, el del público)

## 4. Verificación

- [x] 4.1 Admin en localhost: planilla con valor desde la vista, detalle con montos, modal de Precios con la columna Torneo (backfill visible)
- [ ] 4.2 Como organizador (invitación de prueba): ve toda la planilla sin montos, crea y mueve un torneo, carga resultado, no cancela fuera de término ni con cobros, no entra a Caja/Reportes/Canchas/Equipo/Políticas; lectura directa por API de `reservations`, `payments` y `sport_prices` vacía — pendiente de definir dónde probar (club real o club de prueba)
- [x] 4.3 `pnpm exec tsc --noEmit` y `pnpm build`
