## 1. Base de datos

- [x] 1.1 Migración `0016_club_hours.sql`: `settings.open_time` / `close_time` (con check), iniciadas con la apertura más temprana y el cierre más tardío de las canchas activas de cada club, y baja de `courts.slot_duration`, `open_time` y `close_time`; `supabase/rollback/0016_down.sql`; probar subir → bajar → subir en local con un club de canchas con horarios distintos (queda 09:00–23:00)

## 2. Lógica

- [x] 2.1 `lib/availability.ts`: `ClubHours`, `startTimes`, `firstStartFrom` (19:44 → 20:00), `maxDurationAt`, `findFreeSlots` con duración; `lib/courts.ts` (sin duración ni horario, `Court` y esquema); `useClubSettings` con el horario; verificar con pruebas de las funciones (límites del horario, redondeo, hueco corto, solapamiento)
- [x] 2.2 `prepareReservation` y esquema del turno: la duración se valida para todos los tipos (30–360, pasos de 30), el inicio en :00/:30 dentro del horario del club y sin superposición; quitar `slot_duration` de las acciones de canchas; verificar los rechazos — rechazos verificados con pruebas de `fitsClubHours` y del esquema (el servidor usa las mismas funciones) y la superposición con el chequeo que ya existía

## 3. Pantallas

- [x] 3.1 Formulario del turno: horarios cada 30 min, selector de duración para todos los tipos (1 h por defecto, se ajusta a lo que entra), teléfono en su propia fila; verificar 19:44 → 20:00 de 1 h, 30 min, 1 h 30 y el hueco corto
- [x] 3.2 Planilla de escritorio (grilla de 30 min y rango del club), planilla del celular (huecos libres como filas), buscador con selector de duración y Hoy (huecos de 1 h o más y ocupación)
- [x] 3.3 Canchas: formulario de alta y edición solo con nombre y deporte; tarjetas sin duración ni horario; resumen de Precios y ejemplo de Políticas con 1 hora
- [x] 3.4 Políticas: `ClubHoursForm` con `updateClubHoursAction` (auditoría y mensaje en Actividad); modal de bienvenida con el paso "Horario del club"
- [x] 3.5 Verificar en el navegador a 1440 y 390 px: alta de un club (bienvenida → horario → precios), cambio de horario en Políticas, reserva de 30 min, 1 h y 2 h 30, turno fijo, buscador y Hoy

## 4. Cierre

- [x] 4.1 `grep -rn "slot_duration\|court.open_time\|court.close_time" app lib components hooks` sin resultados; `pnpm exec tsc --noEmit` y `pnpm build` pasan; (`scripts/dev/seed-test-club.mjs` ya estaba obsoleto desde la `0004`, con `owner_id` y precios en la cancha: no se tocó)
- [x] 4.2 Actualizar README, `docs/PROJECT_DOCUMENTATION.md` y `docs/next-steps.md` (prueba manual)
- [x] 4.3 Aplicar `0016` en la base real y verificar las columnas — aplicada el 2026-10-18
