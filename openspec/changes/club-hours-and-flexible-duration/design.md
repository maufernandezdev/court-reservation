## Context

`courts` guarda `slot_duration` (30/60/90), `open_time` y `close_time`. De ahí salen las franjas de cada cancha (`getCourtSlots`), la planilla, el buscador, los huecos de Hoy y la validación de `prepareReservation`, que obliga a los turnos estándar y de profe a durar `court.slot_duration`. La base ya admite cualquier duración de 30 a 360 min en `reservations`, en pasos de 30 en el torneo; los turnos fijos guardan su propia duración. La base de producción está vacía.

## Goals / Non-Goals

**Goals:**
- Duración elegida en cada turno (1 h por defecto, mínimo 30 min).
- Horario de apertura y cierre único para el club.

**Non-Goals:**
- Horario por día de la semana, excepciones por cancha, o inicio fuera de :00/:30.

## Decisions

- **El horario va en `settings` (`open_time`, `close_time`), una fila por club**, como `night_starts_at`. Check `open_time < close_time`. La migración los inicializa con el mínimo/máximo de las canchas activas y borra las tres columnas de `courts` (que arrastran sus checks). Rollback: vuelve a crearlas en `courts` con el horario del club y duración 60.
- **Un solo tipo de dato de horario en el código:** `ClubHours { open_time, close_time }` (`lib/availability.ts`). `useClubSettings` lo trae junto con el resto de la configuración y se pasa como argumento a las funciones puras en lugar de leerlo de cada cancha.
- **Franjas de 30 min:** `startTimes(hours, duration)` lista los inicios válidos (cada 30 min mientras `inicio + duración ≤ cierre`); `firstStartFrom(hours, fromMinutes)` redondea hacia arriba a :00/:30 y se limita al horario (19:44 → 20:00). Reemplazan a `getCourtSlots` y `defaultSlot`.
- **Duración máxima en el formulario:** `maxDurationAt` toma el menor entre 360, el cierre y el comienzo del siguiente turno de esa cancha y fecha (sin contar el turno que se edita). Las opciones van de 30 a ese máximo; si la duración actual no entra se baja a ese máximo. El servidor repite todas las validaciones (múltiplo de 30, dentro del horario, sin superposición) porque es quien decide.
- **Duración por defecto 1 h** como constante (`DEFAULT_DURATION_MINUTES = 60`); el torneo usa `tournament_duration_minutes`. Al cambiar el tipo de turno en el alta se aplica el valor por defecto del nuevo tipo.
- **Planilla de escritorio:** una celda libre por cada fila de 30 min sin turno (y no pasada), en lugar de una por franja de la cancha. El rango sale del horario del club. **Celular:** cada hueco libre es una fila "Libre HH:MM – HH:MM" con "Reservar" que abre el turno al comienzo del hueco (o en la próxima media hora si es hoy).
- **Buscador:** selector de duración (30 min, 1 h, 1 h 30, 2 h; 1 h por defecto); `findFreeSlots` devuelve los inicios en que cabe esa duración.
- **Hoy:** un hueco cuenta como libre desde 1 hora (la duración por defecto); la ocupación usa el horario del club por cada cancha.
- **Políticas:** componente `ClubHoursForm` junto a `ClubDetailsForm`, con la acción `updateClubHoursAction` (admin) que hace upsert en `settings`, registra `club.updated` y revalida. El modal de bienvenida suma el paso de horario que usa la misma acción.

## Risks / Trade-offs

- [Turnos existentes fuera del nuevo horario] → no se borran ni se ocultan; la planilla extiende su rango para mostrarlos y solo los nuevos se validan.
- [Más celdas en la planilla de escritorio] → son botones de una fila de 30 min; con 13 h son 26 por cancha, similar a lo que hay hoy con 30 min de franja.
- [Quien dependía de la duración fija por cancha] → ya no existe: el formulario arranca en 1 hora y la cambia quien reserva.

## Migration Plan

1. Escribir `0016_club_hours.sql` y `supabase/rollback/0016_down.sql`; probar subir → bajar → subir en el Supabase local con canchas de horarios distintos.
2. Implementar código y verificar en el navegador a 1440 y 390 px.
3. Aplicar en la base real (vacía) y desplegar junto con el código: el código viejo lee columnas que ya no existen.
