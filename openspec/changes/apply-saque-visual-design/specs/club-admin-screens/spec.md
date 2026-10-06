## Purpose

Define la presentación de las pantallas de administración del club (Canchas, Equipo, Políticas) y la nueva página de Actividad que muestra la auditoría de acciones.

## ADDED Requirements

### Requirement: Canchas como tarjetas con resumen de precio
La pantalla Canchas SHALL mostrar cada cancha activa como tarjeta con nombre, deporte, precio por hora, duración de turno, horario y seña. Al crear o editar, el formulario MUST mostrar en vivo el valor de un turno y el monto de la seña calculados con la lógica de precios existente, y conservar la validación actual.

#### Scenario: Resumen en vivo
- **WHEN** el admin pone $24.000 por hora, turno de 60 min y seña del 30%
- **THEN** el formulario muestra "Un turno de 60 min: $24.000 · seña $7.200"

### Requirement: Equipo con matriz de permisos
La pantalla Equipo SHALL mostrar a las personas del club con iniciales, nombre, email y rol, y una tabla que explique qué puede hacer cada rol (ver planilla, crear y mover turnos, registrar cobros, cancelar fuera de término, ver caja y reportes, configurar canchas y políticas, invitar y cambiar roles), consistente con los permisos que la app realmente aplica.

#### Scenario: Matriz coherente
- **WHEN** se compara la matriz con lo que puede hacer un profesor
- **THEN** la matriz indica que el profesor no puede cancelar fuera de término, igual que la restricción aplicada en la planilla

### Requirement: Políticas con línea de tiempo y ejemplo
La pantalla Políticas SHALL mostrar una línea de tiempo con la ventana de cancelación configurada ("en término" vs "fuera de término") y un ejemplo calculado con un turno real del club (o un valor de referencia indicado como tal) que muestre cuánto se retiene, cuánto queda a favor o cuánto queda debiendo. El ejemplo MUST actualizarse mientras el admin cambia los valores, antes de guardar.

#### Scenario: Cambio de penalidad
- **WHEN** el admin cambia la penalidad de 50% a 25% sin guardar
- **THEN** el ejemplo se recalcula con 25% y el botón "Guardar cambios" queda habilitado

### Requirement: Página de Actividad
El panel SHALL ofrecer la página Actividad (`/dashboard/actividad`), solo para administradores, que lista las entradas de auditoría del club de la más reciente a la más antigua, agrupadas por día, con hora, quién lo hizo, una frase en español de qué hizo y una etiqueta del tipo de acción (Creó, Modificó, Cobró, Canceló). MUST permitir filtrar por persona y por tipo de acción, y paginar o cargar más cuando haya muchas entradas.

#### Scenario: Ver un cobro
- **WHEN** un operador registró un cobro de $24.000 en efectivo
- **THEN** Actividad muestra una entrada con su nombre, la hora y "cobró $24.000 en efectivo a <cliente> · <cancha>, <horario>"

#### Scenario: Acceso de no-admin
- **WHEN** un operador intenta abrir `/dashboard/actividad`
- **THEN** no ve el log y recibe un aviso de que necesita ser administrador
