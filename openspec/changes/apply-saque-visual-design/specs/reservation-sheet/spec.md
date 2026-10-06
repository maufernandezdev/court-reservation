## Purpose

Define la presentación de la planilla de reservas en escritorio y celular, el panel de detalle del turno y el buscador rápido de disponibilidad, sobre la lógica de reservas, cobros y cancelaciones existente.

## ADDED Requirements

### Requirement: Grilla de escritorio por duración real
En escritorio la planilla SHALL mostrar las canchas como columnas y el horario como filas de 30 minutos. Cada turno activo MUST dibujarse como un único bloque que ocupa toda su duración, con el estilo de su estado de pago, nombre del cliente y rango horario. Las franjas libres dentro del horario de la cancha MUST permitir crear un turno al tocarlas, y las franjas fuera de horario MUST verse deshabilitadas.

#### Scenario: Turno de 90 minutos
- **WHEN** existe un turno de 18:00 a 19:30
- **THEN** se ve un solo bloque que cubre las tres franjas, no tres celdas separadas

#### Scenario: Crear desde franja libre
- **WHEN** el usuario toca una franja libre de una cancha a las 21:00
- **THEN** se abre el alta de turno con esa cancha, fecha y horario precargados

### Requirement: Línea de "ahora"
Cuando la fecha visible es hoy, la planilla SHALL mostrar una línea horizontal en la hora actual con la hora rotulada, y MUST actualizarse al menos cada minuto.

#### Scenario: Otro día
- **WHEN** el usuario navega al día siguiente
- **THEN** la línea de "ahora" no se muestra

### Requirement: Detalle del turno en panel lateral
En escritorio, al tocar un turno la planilla SHALL mostrar su detalle en un panel lateral (sin tapar la grilla) con cliente, teléfono, cancha, horario, duración, valor, cobrado, saldo, estado de pago, acciones (registrar cobro, editar, cancelar), el resultado de la política de cancelación según la anticipación y el historial de acciones según el rol. Todas las acciones MUST usar la lógica existente (cobros, cancelación con penalidad, restricciones del profesor, auditoría). En celular el detalle MUST abrirse como hoja desde abajo.

#### Scenario: Turno seleccionado
- **WHEN** el usuario toca un turno en la grilla
- **THEN** el bloque queda resaltado y el panel muestra su detalle

#### Scenario: Profesor dentro de la ventana
- **WHEN** un profesor abre un turno a menos horas que la ventana de cancelación
- **THEN** la acción de cancelar no está disponible y se explica que debe consultar con un administrador

### Requirement: Planilla en celular por cancha
En celular la planilla SHALL mostrar un selector de día y un selector de cancha, y debajo la lista de turnos y huecos de esa cancha. Por defecto MUST empezar cerca de la hora actual, con la opción de ver desde la apertura. Los huecos que ya pasaron MUST verse como "Sin uso" y no ofrecer reservar. Un botón flotante "Nuevo turno" MUST estar siempre visible.

#### Scenario: Hueco futuro
- **WHEN** la cancha tiene libre de 20:00 a 21:00 hoy y son las 18:40
- **THEN** se ve una fila "20:00 · Libre" con botón "Reservar"

### Requirement: Buscador rápido "¿Hay cancha?"
La planilla SHALL ofrecer un buscador de disponibilidad por día, deporte y hora desde, que lista los turnos libres (horario y cancha) según la duración de turno de cada cancha, permite reservar uno y permite copiar al portapapeles un texto en español listo para WhatsApp con los resultados.

#### Scenario: Sin resultados
- **WHEN** no quedan turnos libres desde la hora elegida
- **THEN** se muestra "No queda nada libre desde ese horario. Probá otro día."

#### Scenario: Copiar resultados
- **WHEN** el usuario toca "Copiar disponibilidad"
- **THEN** el portapapeles contiene un saludo, la lista de horarios y canchas, y la pregunta "¿Te reservo alguno?"
