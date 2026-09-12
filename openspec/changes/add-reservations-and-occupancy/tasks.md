# Tasks — add-reservations-and-occupancy

> Dependencia: requiere `add-court-management` implementado (canchas reales en Supabase).

## 1. Base de datos (Supabase)

- [ ] 1.1 Crear `supabase/migrations/0002_reservations.sql` con el DDL de `reservations` (tabla, FKs con cascade, unique `(court_id, date, time)`, índice en `(user_id, date)`, RLS select/insert/update/delete por `auth.uid()`) según design.md
- [ ] 1.2 Aplicar el SQL en el SQL Editor del dashboard de Supabase y verificar en Table Editor que la tabla existe con RLS habilitado

## 2. Hook de datos

- [ ] 2.1 Crear `hooks/use-reservations.ts` exponiendo `{ reservations, isLoading, error, createReservation, updateReservation, deleteReservation }`, cargando por fecha con `.eq("date", ...)` y ordenado por hora, y verificar que `pnpm exec tsc --noEmit` pasa
- [ ] 2.2 Traducir el error de unique violation (código `23505`) en el mensaje "Esa cancha ya está reservada en ese horario" y devolverlo en el resultado de `createReservation`/`updateReservation`

## 3. Grilla de reservas: persistencia real

- [ ] 3.1 Refactor de `app/dashboard/reservas/page.tsx` para reemplazar el estado mock de reservas por `useReservations(selectedDate)`: cargar por fecha, y verificar que las reservas de la fecha seleccionada aparecen en la grilla
- [ ] 3.2 Conectar el dialog de alta para que persista con `createReservation` (tomando `court_id` solo de las canchas del usuario) y refrescar la grilla tras guardar, y verificar que una reserva nueva sobrevive un refresh de página
- [ ] 3.3 Conectar la edición y eliminación (con confirmación existente) para persistir con `updateReservation`/`deleteReservation`, y verificar que ambas se reflejan tras recargar
- [ ] 3.4 Verificar que intentar crear dos reservas en el mismo slot muestra el mensaje de doble reserva y no guarda la segunda

## 4. Filtro por tipo compartido

- [ ] 4.1 Crear `components/court-type-filter.tsx` (Select con Todas/Fútbol/Tenis/Pádel, value `CourtType | "all"`) y usarlo desde la grilla de reservas reemplazando el filtro inline del change anterior, y verificar que el filtro sigue funcionando igual

## 5. Home de ocupación

- [ ] 5.1 Reescribir `app/dashboard/page.tsx` para que deje de redirigir y muestre el mapa de ocupación: título con fecha/hora actual, `CourtTypeFilter`, grid de cards por cancha con estado (ocupada: titular + franja "HH:00 – HH:00" / disponible), estados de carga y vacío con CTA a `/dashboard/canchas`, y botón "Refrescar"
- [ ] 5.2 Calcular la franja "en curso" como el bloque de 1h (alineado a la grilla, desde 09:00) que contiene la hora actual del navegador, haciendo join en memoria entre `useCourts()` y `useReservations(hoy)`, y verificar que una reserva del bloque actual marca la cancha como ocupada con el titular correcto

## 6. Verificación integral

- [ ] 6.1 Con `test@user.com`: crear una reserva hoy en el bloque actual para una cancha y verificar programáticamente (script, como `scripts/verify-courts.mjs`) que la home la reporta ocupada con el titular correcto, y que el slot duplicado es rechazado
- [ ] 6.2 Verificar aislamiento RLS: sin sesión no se lee `reservations`, e intento de insert con `court_id` ajeno o `user_id` ajeno es rechazado
- [ ] 6.3 Verificar que un usuario sin canchas ve el estado vacío tanto en home como en reservas
- [ ] 6.4 Correr `pnpm build` y verificar que compila sin errores
- [ ] 6.5 Documentar en `docs/PROJECT_DOCUMENTATION.md` la semántica de `time` (franja de inicio `HH:00`, bloques de 1h) y del cálculo de "en curso"
