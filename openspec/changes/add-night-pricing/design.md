## Context

- Desde `add-reservation-types-and-socios`, cada tipo de cancha tiene una fila en `sport_prices` (público, profe, seña) y el valor se fija en `reservations.price` al reservar: `quotePrice(prices, kind, duración)` en el cliente y en `prepareReservation`; `ensure_series_until` (SQL) calcula el valor de las fechas de los fijos.
- Las políticas del club viven en `settings` (una fila por club, editable por el admin).
- Las franjas de inicio salen de `getCourtSlots(court)`; las horas se manejan como `"HH:MM"`.

## Goals / Non-Goals

**Goals:**
- Una sola regla (hora de inicio) aplicada igual en cliente, servidor y SQL.
- Cero cambios de valor en turnos existentes ni en turnos nuevos hasta que el admin cargue los precios de noche.

**Non-Goals:**
- Cobro proporcional para turnos que cruzan el horario (el usuario eligió "según la hora de inicio").
- Precios por día de la semana, feriados o temporada; horario de noche distinto por deporte o por cancha.

## Decisions

### 1. Columnas de noche en `sport_prices`
`public_night_price_per_hour` y `profe_night_price_per_hour` (`numeric(10,2) not null default 0 check >= 0`). La migración las completa con el precio de día de cada fila, así el valor no cambia hasta que el admin lo configure. La seña no cambia de regla: se calcula sobre el valor del turno (fijo o %), así que de noche un porcentaje rinde más y un monto fijo queda igual.
- Alternativa: recargo único de luz. Descartada por el usuario.

### 2. Horario de noche en `settings.night_starts_at`
`time not null default '18:00'`. Se edita en Canchas → Precios (al lado de las tarjetas, porque es parte del precio), con la misma acción del admin que guarda los precios o una propia (`updateNightStartAction`, auditoría `prices.updated` con el horario).
- Alternativa: columna en `clubs`. Descartada: `settings` ya agrupa las reglas del club y tiene RLS de admin.

### 3. Regla única: `isNight(start, nightStartsAt)`
`timeToMinutes(start) >= timeToMinutes(nightStartsAt)`. `hourlyPrice(prices, kind, isNight)` elige entre las cuatro columnas y `quotePrice(prices, kind, duración, inicio, nightStartsAt)` multiplica por la duración. El servidor lee `night_starts_at` de `settings` en `prepareReservation`; el cliente lo toma de `useClubSettings`.
- En una edición, `prepareReservation` deja de considerar "sin cambios" el valor si cambió la hora de inicio (antes miraba cancha, tipo y duración).

### 4. Fijos
`ensure_series_until` lee `settings.night_starts_at` del club y elige la columna según `reservation_series.start_time` (todas las fechas de una serie tienen la misma hora, así que todas caen del mismo lado).

### 5. Pantallas
- Precios: cada tarjeta pasa a dos filas (Día / Noche) con público y profe; el resumen muestra el valor de un turno de día y de uno de noche. Arriba de las tarjetas, "La noche empieza a las [18:00]".
- Tarjetas de cancha: "Turno día" y "Turno noche" (público).
- Formulario: el resumen ya muestra el valor; ahora depende también del horario elegido y agrega "· noche" cuando corresponde.
- Buscador: cada resultado usa la hora de esa franja.

## Risks / Trade-offs

- [Turno de 17:30 a 19:00 se cobra todo a precio de día] → Es la regla elegida; queda explicada en Precios ("se cobra según la hora de inicio").
- [El admin cambia el horario de noche] → Solo afecta turnos nuevos o editados; los reservados mantienen su valor.

## Migration Plan

1. Probar `0010` en el Supabase local: después de aplicarla, los valores cotizados de día y de noche son iguales a los de antes.
2. Aplicar en producción con confirmación del usuario (es aditiva: el código anterior sigue funcionando).
3. Rollback: `supabase/rollback/0010_down.sql` (borra las columnas y restaura `ensure_series_until` de `0008`).
