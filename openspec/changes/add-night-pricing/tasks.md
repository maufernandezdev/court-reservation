Cada fase termina con `pnpm exec tsc --noEmit`, `pnpm build`, la recorrida de las pantallas tocadas contra el Supabase local (Playwright a 1440 y 390 px) y un commit propio.

## 1. Base de datos

- [ ] 1.1 Migración `0010_night_pricing.sql`: columnas de noche en `sport_prices` (iniciadas con el precio de día), `settings.night_starts_at` (18:00) y `ensure_series_until` eligiendo el precio según la hora de inicio de la serie; verificar en local que después de aplicarla los valores no cambian y que un fijo nocturno toma el precio de noche
- [ ] 1.2 `supabase/rollback/0010_down.sql` y prueba subir → bajar → subir en local

## 2. Cálculo

- [ ] 2.1 `lib/pricing.ts`: `isNight`, `hourlyPrice` y `quotePrice` con hora de inicio y horario de noche; `useClubSettings` trae `night_starts_at`; `prepareReservation` lee el horario y recalcula en la edición si cambia la hora; verificar los escenarios de "Precio según la hora de inicio" (17:30 de día, torneo de 18:00 a 19:30, profe a las 20:00, mover de 16:00 a 19:00, turnos ya reservados)

## 3. Pantallas

- [ ] 3.1 Precios en Canchas: filas Día y Noche (público y profe) en cada tarjeta, horario de inicio de la noche editable (solo admin, auditado) y resumen de día y de noche; tarjetas de cancha con turno día y turno noche; verificar a 1440 y 390 px
- [ ] 3.2 Formulario del turno y buscador "¿Hay cancha?" con el valor según la hora elegida; verificar el cambio de valor al mover el horario de las 17:00 a las 18:00 y en resultados del buscador desde las 20:00

## 4. Cierre

- [ ] 4.1 Aplicar `0010` en producción con confirmación del usuario y verificar que los turnos existentes conservan su valor
- [ ] 4.2 Actualizar README y `docs/PROJECT_DOCUMENTATION.md`, y agregar el punto a `docs/next-steps.md` como aplicado
