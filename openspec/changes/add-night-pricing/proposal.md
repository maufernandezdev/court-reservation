> **Origen:** pedido del usuario (2026-10-12): las canchas cuestan más de noche por el costo de la luz. Depende de `add-reservation-types-and-socios` (precios por tipo de cancha y valor fijado en el turno).

## Why

En el club, el alquiler cuesta más de noche porque se prenden las luces: hasta las 18:00 rige un precio y desde las 18:00, otro, en todas las canchas y para cualquier tipo de cancha. Hoy cada tipo de cancha tiene un solo precio público y uno de profe, así que los turnos nocturnos se cobran de menos o hay que corregirlos a mano.

## What Changes

- **Precio de noche por tipo de cancha:** cada tarjeta de Precios (tenis, pádel, fútbol) suma el precio de noche, para el público y para profes, además de los de día.
- **Horario de inicio de la noche:** un único horario para todo el club, editable por el admin en Precios (arranca en 18:00).
- **Regla de cobro:** el precio de día o de noche se elige **por la hora de inicio** del turno. Si empieza antes del horario de noche, se cobra todo a precio de día; si empieza a esa hora o después, todo a precio de noche. Vale para turnos estándar, de profe, de torneo y para las fechas de los turnos fijos.
- **El valor sigue fijado en el turno:** los turnos ya reservados no cambian. En una edición, el valor se recalcula también si cambia la hora de inicio.
- **Dónde se ve:** el formulario del turno, el buscador "¿Hay cancha?", las tarjetas de Canchas y el resumen de Precios muestran el valor según el horario.

## Capabilities

### New Capabilities
- `night-pricing`: precio de noche por tipo de cancha, horario de inicio de la noche y regla por hora de inicio.

### Modified Capabilities
<!-- `sport-pricing` vive en `add-reservation-types-and-socios`, todavía sin archivar: no hay spec en openspec/specs/ para escribir un delta MODIFIED. Al archivar ambos, `night-pricing` complementa el requisito "Valor de cada turno" de `sport-pricing`. -->

## Impact

- **Base de datos:** migración `0010_night_pricing.sql` (columnas `public_night_price_per_hour` y `profe_night_price_per_hour` en `sport_prices`, iniciadas con el precio de día; `settings.night_starts_at`, 18:00 por defecto; `ensure_series_until` usa el precio según la hora de inicio de la serie).
- **Código:** `lib/pricing.ts` (`quotePrice` recibe la hora de inicio y el horario de noche), `prepareReservation` (recalcula si cambia la hora), formulario del turno, buscador, Canchas (tarjetas y sección Precios), `useClubSettings`.
- **Fuera de alcance:** precios por día de la semana o por temporada, cobro proporcional de turnos que cruzan el horario, recargo distinto por cancha.
