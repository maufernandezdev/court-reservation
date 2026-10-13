## Context

- El turno (`reservations`) hoy tiene `customer_name` y `phone` libres; el valor se calcula al leer con `courts.price_per_hour × duración` (`lib/pricing.ts`), así que cambiar el precio de una cancha cambia el valor de turnos ya reservados. La seña también es por cancha.
- La duración del turno sale de `courts.slot_duration` (30/60/90); la grilla ya dibuja bloques por `duration_minutes` y el chequeo de superposición usa rangos (`assertNoOverlap`).
- `lib/reservation-tone.ts` define el tono por estado de pago (relleno del bloque) y reserva un tono `fixed` sin uso.
- Socios es una pantalla de ejemplo (`MEMBERS` mock) con "Estado de cuota".
- Todo está por club (`club_id`, RLS `is_member`/`is_staff`/`is_admin`) desde `0007`; las consultas filtran por el club activo.
- Supabase no tiene jobs programados configurados en el proyecto.

## Goals / Non-Goals

**Goals:**
- Un solo modelo de turno para estándar, profe, torneo y fijos, de modo que cobros, cancelación, grilla, Hoy y Caja sigan funcionando sin ramas especiales.
- Fijar el valor en el turno para que los cambios de precio no reescriban el pasado.
- Que los fijos se vean en cualquier fecha futura sin depender de un proceso programado.

**Non-Goals:**
- Editar una serie fija ya creada (cambiar día, hora o cancha): se da de baja y se crea otra.
- Abono mensual de fijos, alerta por liberaciones de fijos (estaban en `add-fixed-reservations`).
- Perfil propio del profe para elegir su color (lo cubre el cambio de "Editar perfil"); acá lo cambia el admin en Equipo.
- Crear socios desde el buscador del turno (la persona no socia queda solo como nombre en ese turno).

## Decisions

### 1. Valor fijado en el turno (`reservations.price`)
Columna `price numeric(10,2) not null default 0`. Se calcula en el servidor al crear y al editar cancha, tipo o duración: `precio por hora (público o profe del deporte) × duración / 60`. `getSlotPrice(court, minutes)` se reemplaza por `reservationPrice(reservation)` (lee `price`) para cobros, cancelación, Hoy, Caja y el detalle; para lo que todavía no es un turno (formulario y buscador) se usa `quotePrice(prices, sport, kind, minutes)`.
- Backfill: `price = courts.price_per_hour × duration_minutes / 60` (lo que valía hasta ahora).
- Alternativa: seguir calculando al leer con los precios del deporte. Descartada: el cambio de precios alteraría turnos ya cobrados o señados.

### 2. Precios por deporte (`sport_prices`)
`sport_prices(club_id, sport, public_price_per_hour, profe_price_per_hour, deposit_enabled, deposit_type, deposit_value, updated_at)`, PK `(club_id, sport)`, `sport in ('tenis','padel','futbol')`. RLS: miembros leen, admin escribe. La seña pasa a ser por deporte y se calcula sobre el `price` del turno (`depositFor(prices, reservation)`).
- Se crea la fila al crear una cancha de un deporte nuevo (upsert en la acción) y en `create_club`.
- Backfill: por club y deporte, el precio y la seña de la cancha activa de mayor precio; profe = público.
- Las columnas de precio y seña de `courts` quedan en la base sin uso (para poder volver atrás) y se dejan de leer y escribir; se eliminan en un cambio posterior.
- UI: sección "Precios" arriba de las tarjetas en Canchas, una tarjeta por deporte presente; el formulario de cancha pierde precio y seña.

### 3. Tipo de turno y profe en `reservations`
`kind text not null default 'standard' check (kind in ('standard','profe','torneo'))` y `profe_user_id uuid null references auth.users`. Check: `kind = 'profe'` ⇔ `profe_user_id is not null`. La Server Action valida que `profe_user_id` sea miembro `profesor` del club; si quien crea es `profesor`, fuerza `kind = 'profe'` y `profe_user_id = auth.uid()`.
- Duración: estándar y profe usan `slot_duration` de la cancha (como hoy). Torneo usa la duración elegida (default `settings.tournament_duration_minutes`, pasos de 30, 30–360, dentro del horario de la cancha).
- Validación de franjas: para torneo el inicio debe ser una franja de la cancha y el fin no puede pasar del cierre.

### 4. Personas del turno (`reservation_participants`)
`reservation_participants(id, club_id, reservation_id → reservations on delete cascade, position 1..4, socio_id → socios on delete set null, name)` con `unique (reservation_id, position)`. La posición 1 es quien reserva y se copia en `reservations.customer_name` (y su teléfono en `phone`), así siguen funcionando el saldo a favor por teléfono, Actividad, Caja y la búsqueda existentes.
- Se guardan en la misma Server Action que el turno: se inserta el turno y después sus personas; si fallan las personas, se borra el turno (compensación) y se informa el error.
- Para mostrar: estándar y profe muestran quien reserva (+N si hay más); torneo muestra "A vs B" (singles) o "A / B vs C / D" (dobles).
- Turnos existentes: backfill con una persona (posición 1) con `customer_name`.

### 5. Socios (`socios`)
`socios(id, club_id, full_name, dni, phone, email, created_by, created_at, deleted_at)`, índice único parcial `(club_id, dni) where dni <> '' and deleted_at is null`, índice para búsqueda por `lower(full_name)`. RLS: miembros leen (el profe necesita buscar), staff escribe. Baja lógica (`deleted_at`) para no romper turnos.
- Buscador de personas: componente `PeopleCombobox` sobre `Command` de shadcn (se agrega con el CLI) + `Popover`; consulta a `socios` con `or(full_name.ilike.%q%,dni.ilike.%q%)`, debounce 200 ms, máximo 8 sugerencias. Las personas fijadas se muestran como chips quitables.

### 6. Turnos fijos materializados (`reservation_series`)
`reservation_series(id, club_id, court_id, weekday 0–6, start_time, duration_minutes, kind, profe_user_id, customer_name, phone, participants jsonb, starts_on, ends_on null, generated_until, created_by, created_at)`; `reservations.series_id` con `unique (series_id, date)`.
- Cada fecha se **materializa** como un turno común (`series_id` apuntando a la serie) para reutilizar cobros, cancelación, grilla y Caja sin cambios.
- Función `ensure_series_until(p_club_id, p_until date)` (`SECURITY INVOKER`, respeta RLS): para cada serie activa del club con `generated_until < p_until`, inserta las fechas faltantes con el precio vigente, salteando las que se superponen con un turno activo, y actualiza `generated_until`. Es idempotente (`on conflict do nothing`).
- Al crear la serie se materializan 8 semanas y se devuelven las fechas salteadas. La planilla, Hoy y el buscador llaman a `ensure_series_until` con la fecha que muestran (hasta 1 año adelante) antes de leer turnos. Así cualquier fecha futura muestra el fijo sin un job programado.
- Alternativa: generar con `pg_cron`. Descartada por ahora: requiere habilitar y monitorear jobs en el proyecto, y la generación al consultar cubre el caso.
- Baja desde una fecha: `ends_on = fecha - 1`; se cancelan (estado cancelado, sin movimientos de dinero, motivo "Baja de turno fijo") las fechas ≥ fecha sin cobros; las que tienen cobros quedan activas y se devuelven para avisar. Auditoría `series.created` / `series.ended`.
- Liberar una fecha suelta = cancelar ese turno con el flujo actual.

### 7. Color de profe (`memberships.color`)
Paleta fija de 8 colores con contraste AA sobre texto blanco u oscuro (`lib/profe-colors.ts`). Al aceptar una invitación o cambiar el rol a `profesor` sin color, se asigna el primero libre del club. Equipo muestra un selector de color en las filas de profesores (solo admin).

### 8. Distinción visual
El relleno del bloque sigue indicando el estado de pago en los turnos estándar. Para los otros tipos el bloque usa el color del tipo y el estado de pago pasa a una etiqueta corta dentro del bloque:
- **Profe:** fondo del color del profe, nombre del profe como título y alumnos debajo.
- **Torneo:** fondo `line` (azul de marca, el tono `fixed` que ya existía) con ícono de trofeo y "A vs B".
- **Fijo:** ícono de repetición en la esquina (se combina con estándar o profe).
- Leyenda de la planilla: estados de pago + Profe, Torneo y Fijo. `lib/reservation-tone.ts` suma `kindStyle(reservation, profeColor)` como única fuente para grilla, celular, Hoy y detalle.

### 9. Duración estándar de torneo
`settings.tournament_duration_minutes int not null default 90 check (between 30 and 360 and % 30 = 0)`, editable por el admin en Políticas (sección "Torneos").

### 10. Una migración (`0008_reservation_types_and_socios.sql`)
Tablas nuevas, columnas nuevas con defaults compatibles, backfills (precios, `price`, personas), funciones y RLS. Como solo agrega (no renombra ni borra), el código anterior sigue funcionando con `0008` aplicada, así que la migración puede aplicarse antes del despliegue. Vuelta atrás: `supabase/rollback/0008_down.sql`.

## Risks / Trade-offs

- [Fechas fijas materializadas pueden ocupar franjas que después alguien quiere] → Es el comportamiento esperado de un fijo; se libera cancelando la fecha o dando de baja.
- [`ensure_series_until` en cada consulta suma latencia] → Sale rápido si `generated_until` ya cubre la fecha (una lectura); se llama una vez por cambio de fecha.
- [Dos pestañas generan la misma semana a la vez] → `unique (series_id, date)` + `on conflict do nothing`.
- [Personas guardadas en dos pasos (turno y después personas)] → Compensación borrando el turno si fallan las personas; la ventana de inconsistencia es mínima y sin efecto en dinero.
- [Precio por deporte tomado de la cancha más cara en la migración] → En el club real todas las canchas del mismo deporte tienen el mismo precio; el admin puede corregirlo en Precios.
- [Turno de profe con color de fondo y texto] → La paleta se elige con contraste verificado y el texto usa blanco o tinta según el color.

## Migration Plan

1. Probar `0008` en el Supabase local con datos de la `0007` y conteos antes/después.
2. Aplicar `0008` en producción (es aditiva: el código actual sigue funcionando).
3. Desplegar el código nuevo.
4. Rollback: `0008_down.sql` borra tablas y columnas nuevas (se pierden socios, personas, fijos y precios por deporte; los precios por cancha siguen en `courts`).
