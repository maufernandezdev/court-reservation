> **Origen:** pedido del usuario (2026-10-18). Complementa `add-reservation-types-and-socios` (turnos de profe y jugadores). Los permisos editables por rol van en un cambio aparte.

## Why

Un profesor da clases a sus alumnos, pero hoy no puede cargarlos como jugadores (Jugadores es solo del admin y el operador) ni tiene dónde ver sus propios turnos: solo ve la planilla del club completa.

## What Changes

- **Los profesores usan Jugadores:** ven la sección, agregan a sus alumnos y los buscan después al crear un turno. Ven a todos los jugadores del club (para no duplicarlos) y solo editan o dan de baja los que agregaron ellos. El admin y el operador siguen gestionándolos todos.
- **Sección "Mis turnos"** (`/dashboard/mis-turnos`, solo para profesores) con sus turnos de profe en tres vistas:
  - **Hoy:** los turnos de hoy en orden, con cancha, horario y alumnos.
  - **Semana:** de lunes a domingo, con navegación entre semanas.
  - **Historial:** los turnos pasados, por mes, con el total de turnos y de horas.
- **Los profesores cancelan siempre sus propios turnos.** Antes no podían hacerlo dentro de la ventana de penalidad ni si el turno tenía cobros. Ahora pueden: en término no pasa nada, y fuera de término el sistema muestra cuánto se les va a cobrar y piden aceptar la penalidad antes de confirmar.
- **Planilla:** la leyenda no muestra "Señada" si el club no pide seña (ni hay turnos señados) y deja de mostrar "Cancelada", porque la planilla no muestra los turnos cancelados.
- En celular, "Mis turnos" ocupa el lugar de Caja en la barra inferior.

## Capabilities

### New Capabilities
- `profe-players`: los profesores gestionan a sus alumnos en Jugadores.
- `my-turns`: vistas de turnos propios para el profesor.

### Modified Capabilities
<!-- Los specs de Jugadores viven en `rename-socios-to-players`, sin archivar: no hay spec en openspec/specs/ para un delta MODIFIED. -->

## Impact

- **Base de datos:** migración `0019_profe_players.sql` (políticas de `players`: cualquier miembro agrega y el profe edita solo lo que agregó) y `0020_profe_cancellation.sql` (función `cancel_own_profe_reservation` y ajuste de `protect_reservation_money`), con sus rollbacks.
- **Código:** acciones y página de Jugadores, menú (`roles` por rol exacto), barra inferior del celular, ruta `app/dashboard/mis-turnos/`, `lib/my-turns.ts`, documentación.
- **Fuera de alcance:** que el profe cobre, cancele o edite turnos desde Mis turnos (sigue en la planilla), reportes de ingresos del profe, cobrar la penalidad desde la aplicación (queda como deuda del teléfono del turno y en Actividad), filtrar la lista de jugadores por profe.
