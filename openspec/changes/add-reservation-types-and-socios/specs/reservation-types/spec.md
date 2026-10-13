## Purpose

Distingue los tipos de turno del club (estándar, profe y torneo), registra las personas que juegan cada turno y hace visible en la planilla de qué tipo es cada uno.

## ADDED Requirements

### Requirement: Personas del turno
Al cargar o editar un turno, el sistema SHALL ofrecer un buscador de personas: al escribir, sugiere socios del club por nombre o DNI; con clic o Enter se fija la persona elegida, y con Enter sobre un texto sin sugerencia se fija como persona no socia. Un turno SHALL tener entre 1 y 4 personas; la primera es quien reserva y su teléfono se usa para el turno (editable). Las personas fijadas SHALL poder quitarse antes de guardar.

#### Scenario: Elegir un socio
- **WHEN** el operador escribe "Mau" y elige "Mauricio Fernández" de las sugerencias
- **THEN** Mauricio queda fijado como quien reserva y el teléfono del turno toma el de su ficha

#### Scenario: Persona que no es socia
- **WHEN** el operador escribe "Juan Pérez", que no es socio, y presiona Enter
- **THEN** Juan Pérez queda fijado como persona del turno sin crear un socio

#### Scenario: Sin personas
- **WHEN** se intenta guardar un turno sin ninguna persona
- **THEN** el sistema no lo guarda e indica que falta quién reserva

#### Scenario: Más de cuatro
- **WHEN** ya hay 4 personas fijadas
- **THEN** el buscador no permite agregar otra

### Requirement: Tipos de turno
Cada turno SHALL ser de un tipo: `estándar`, `profe` o `torneo`. El staff (admin y operador) SHALL elegir el tipo al cargarlo. Un turno de `profe` SHALL indicar qué profe del club lo usa. Cuando lo carga un usuario con rol `profesor`, el turno SHALL ser de tipo `profe` a su nombre, sin poder elegir otro tipo.

#### Scenario: Profe reserva con su cuenta
- **WHEN** un profesor carga un turno
- **THEN** el turno queda como turno de profe a su nombre

#### Scenario: Operador carga un turno de profe
- **WHEN** el operador elige el tipo Profe y el profe "Laura Sosa"
- **THEN** el turno queda como turno de profe de Laura Sosa, con el precio para profes

#### Scenario: Profe sin elegir
- **WHEN** el staff elige el tipo Profe y no elige qué profe
- **THEN** el sistema no lo guarda e indica que falta el profe

### Requirement: Turnos de torneo
Un turno de `torneo` SHALL tener al menos 2 personas (singles o dobles). Su duración SHALL arrancar en la duración estándar de torneo del club y SHALL poder cambiarse en ese turno en pasos de 30 minutos, dentro del horario de la cancha y sin superponerse con otros turnos. La duración estándar SHALL configurarla el `admin` en Políticas.

#### Scenario: Torneo con la duración estándar
- **WHEN** la duración estándar es 90 minutos y el operador carga un torneo a las 18:00 con 2 jugadores
- **THEN** el turno ocupa la cancha de 18:00 a 19:30

#### Scenario: Torneo con duración cambiada
- **WHEN** el operador cambia la duración de ese torneo a 120 minutos
- **THEN** el turno ocupa la cancha de 18:00 a 20:00, siempre que esa franja esté libre

#### Scenario: Torneo con una sola persona
- **WHEN** se intenta guardar un torneo con una sola persona
- **THEN** el sistema no lo guarda e indica que un torneo necesita al menos 2 jugadores

### Requirement: Color de cada profe
Cada miembro con rol `profesor` SHALL tener un color de una paleta del sistema, asignado automáticamente al sumarse y modificable por el `admin` en Equipo.

#### Scenario: Cambiar el color de un profe
- **WHEN** el admin cambia el color de Laura Sosa
- **THEN** los turnos de profe de Laura se muestran con el color nuevo en la planilla

### Requirement: Distinción visual de los tipos
La planilla (escritorio y celular), Hoy y el detalle del turno SHALL distinguir a simple vista los turnos estándar, de profe (con el color y el nombre del profe), de torneo (con los jugadores) y fijos, y SHALL seguir mostrando el estado de pago de cada uno. La planilla SHALL incluir una referencia de los tipos.

#### Scenario: Planilla con tipos mezclados
- **WHEN** en un día hay un turno estándar pagado, un turno de profe pendiente, un torneo y un fijo
- **THEN** cada bloque se distingue por su tipo y muestra su estado de pago

#### Scenario: Torneo en la grilla
- **WHEN** hay un torneo entre "Ana Ruiz" y "Bea Gómez"
- **THEN** el bloque muestra ambos nombres
