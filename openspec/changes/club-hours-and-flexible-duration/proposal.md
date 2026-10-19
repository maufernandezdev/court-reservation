> **Origen:** pedido del usuario (2026-10-18). Cambia lo definido en `add-court-management` / `add-reservations-and-occupancy` (duración y horario por cancha) y en `add-reservation-types-and-socios` (duración del torneo).

## Why

Hoy cada cancha tiene una "duración del turno" fija (30, 60 o 90 min) y su propio horario de apertura y cierre. Pero en un club la gente alquila lo que necesita (media hora, una hora y media, dos y media) y el horario de apertura y cierre es del club, no de cada cancha. Atar la duración a la cancha obliga a reservar en bloques rígidos y duplica el horario en cada cancha.

## What Changes

- **La duración se elige en cada turno:** por defecto 1 hora, mínimo 30 min, en pasos de 30 min, hasta el cierre del club (máximo 6 h, como hoy). Vale para turnos estándar, de profe y de torneo; el torneo sigue arrancando con la duración de Políticas. El valor del turno sigue siendo precio por hora × duración, con precio de día o de noche según la hora de inicio.
- **Los turnos empiezan cada 30 min** (:00 y :30). El primer horario ofrecido para reservar ahora es la próxima media hora (a las 19:44, las 20:00) y ya viene marcado de 20:00 a 21:00; se puede cambiar a 20:00–20:30, 20:00–21:30, etc. Si la hora elegida no admite 1 hora porque hay otro turno o el club cierra, el formulario propone lo que entra.
- **Se quitan de la cancha** la duración del turno y el horario (formulario de alta, edición y tarjetas). La cancha queda con nombre y deporte.
- **Horario del club** (apertura y cierre, en pasos de 30 min; arranca en 09:00–22:00): se configura en Políticas y se pide en el modal de bienvenida del alta del club. Define el rango de la planilla y los horarios válidos de todas las canchas.
- **La planilla pasa a una grilla de 30 min**: tocar un hueco libre abre el turno con 1 hora (o lo que entre). El buscador "¿Hay cancha?" suma un selector de duración y Hoy considera libres los huecos de 1 hora o más.

## Capabilities

### New Capabilities
- `flexible-duration`: duración elegida en cada turno, inicio cada 30 min y valor proporcional.
- `club-hours`: horario de apertura y cierre del club, en Políticas y en el alta.

### Modified Capabilities
<!-- Los specs de duración por cancha viven en cambios todavía sin archivar: no hay spec en openspec/specs/ para escribir un delta MODIFIED. -->

## Impact

- **Base de datos:** migración `0016_club_hours.sql` (`settings.open_time` / `close_time`, iniciadas con el horario más amplio de las canchas del club; se eliminan `courts.slot_duration`, `open_time` y `close_time`) y su rollback.
- **Código:** `lib/availability.ts` (franjas cada 30 min, huecos y duración máxima), `lib/courts.ts`, formulario de cancha, `prepareReservation`, formulario del turno, planilla de escritorio y de celular, buscador, Hoy, tarjetas de Canchas, resumen de Precios, Políticas (`ClubHoursForm`), modal de bienvenida, `useClubSettings`, auditoría y documentación.
- **Fuera de alcance:** horario distinto por día de la semana o por cancha, duración mínima o máxima configurable por club, turnos que empiecen en :15 o :45.
