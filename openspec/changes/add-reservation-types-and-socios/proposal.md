> **Origen:** `docs/next-steps.md` (2026-10-12): Módulo socios, Torneos, Tiempo estándar de torneos, Alquiler de profes, Mejora visual para los tipos de alquileres y Valor del alquiler. Absorbe `add-fixed-reservations` (turnos fijos), que queda sin implementar por separado.

## Why

Hoy un turno es solo "un nombre y un teléfono" con el precio de cada cancha. En la operación real del club hay distintos tipos de alquiler: el estándar al público, el de los profes (con otro precio y que conviene identificar de un vistazo), los turnos de torneo (con dos o cuatro jugadores y una duración fija) y los turnos fijos que se repiten todas las semanas. Además el club necesita cargar a sus socios para no reescribir sus datos en cada reserva, y el precio depende del tipo de cancha (tenis, pádel) y de quién alquila (público o profe), no de cada cancha.

## What Changes

- **Socios:** alta, edición, búsqueda y baja de socios (nombre, DNI, teléfono, correo opcional). Se saca la "cuota" (el club no la usa). Reemplaza la pantalla de ejemplo.
- **Personas del turno:** en el alta del turno, un buscador de personas: escribir "Mau" sugiere "Mauricio Fernández" (socios por nombre o DNI) y Enter o clic lo fija. Se pueden fijar hasta 4 personas, socios o no socios. La primera es quien reserva. **BREAKING** (formulario): el campo libre "Nombre del socio / equipo" se reemplaza por el buscador.
- **Tipos de turno:** estándar, profe y torneo.
  - **Profe:** si reserva un profe con su cuenta, el turno es de profe a su nombre. El staff también puede cargar un turno de profe eligiendo qué profe. Cada profe tiene un color que se ve en la planilla.
  - **Torneo:** requiere al menos 2 personas (singles o dobles). La duración arranca en el tiempo estándar que configura el admin y se puede cambiar en cada turno.
- **Turnos fijos:** un turno estándar o de profe puede repetirse todas las semanas (mismo día, hora y cancha) hasta que se lo da de baja. Cada fecha es un turno normal que se cobra y se cancela como cualquier otro. Se puede liberar una fecha suelta o dar de baja el fijo desde una fecha.
- **Precios por tipo de cancha:** para cada deporte del club, un precio por hora para el público y otro para profes, más la seña. Se configuran una sola vez en Canchas. **BREAKING** (Canchas): la cancha deja de tener precio y seña propios; conserva nombre, tipo, duración del turno y horario.
- **Precio guardado en el turno:** el valor del turno queda fijado al crearlo (según tipo de cancha, tipo de turno y duración), así un cambio de precios no altera turnos ya reservados.
- **Duración estándar de torneo:** se configura en Políticas.
- **Distinción visual:** la planilla (escritorio y celular), Hoy y el detalle distinguen estándar, profe (con su color), torneo y fijo, sin perder el estado de pago.

## Capabilities

### New Capabilities
- `club-socios`: registro de socios del club y su uso como personas de un turno.
- `reservation-types`: tipos de turno (estándar, profe, torneo), personas del turno, duración de torneo y color de profe.
- `fixed-reservations`: turnos fijos semanales, liberación de fechas y baja.
- `sport-pricing`: precio público y precio profe por tipo de cancha, seña por tipo de cancha y precio fijado en cada turno.

### Modified Capabilities
<!-- Las capabilities relacionadas (`court-pricing-and-schedules`, `reservation-payments`, `reservation-sheet`, `daily-overview`, `club-admin-screens`) viven en cambios todavía sin archivar, así que no hay specs en openspec/specs/ para escribir deltas MODIFIED. Al archivar, `sport-pricing` reemplaza el precio y la seña por cancha de `court-pricing-and-schedules`. -->

## Impact

- **Base de datos:** migración `0008` (`socios`, `reservation_participants`, `reservation_series`, `sport_prices`; columnas nuevas en `reservations` —tipo, profe, precio fijado, serie— , `settings.tournament_duration_minutes` y `memberships.color`; backfill de precios y de `reservations.price`; `create_club` crea precios por deporte; RLS por club).
- **Código:** formulario y detalle del turno, grilla de escritorio y celular, Hoy, buscador "¿Hay cancha?", cálculo de precios (`lib/pricing.ts`, `lib/daily-overview.ts`, cancelación y cobros), Canchas (formulario sin precio + sección de precios), Políticas (duración de torneo), Equipo (color de profe), Socios (CRUD), Actividad (acciones nuevas).
- **Dependencias:** componente `command` de shadcn (buscador de personas).
- **Fuera de alcance:** editar perfil y foto (cambio aparte), modificar una serie fija ya creada (se da de baja y se crea otra), abono mensual de fijos, alerta por liberaciones de fijos, portal público.
