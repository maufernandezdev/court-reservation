## Purpose

Permite que el club registre a las personas que juegan en sus canchas (nombre, DNI, teléfono y correo) para encontrarlas rápido al cargar un turno, sin manejar cuotas ni exigir que sean socias. Reemplaza a `club-socios`: mismo comportamiento con un nombre que no supone una cuota.

## ADDED Requirements

### Requirement: Registro de jugadores
El `admin` y el `operador` SHALL poder dar de alta, editar y dar de baja jugadores del club activo con nombre (obligatorio), DNI, teléfono y correo (opcionales), validados antes de guardar. El DNI, si se carga, SHALL ser único entre los jugadores activos del club. El sistema NO SHALL mostrar ni pedir cuota. El `profesor` NO SHALL gestionar jugadores.

#### Scenario: Alta de jugador
- **WHEN** el admin carga "Mauricio Fernández", DNI "30111222" y teléfono "341555111"
- **THEN** el jugador aparece en el listado de Jugadores del club

#### Scenario: DNI repetido
- **WHEN** se carga un jugador con un DNI que ya tiene otro jugador activo del club
- **THEN** el sistema no lo guarda e indica que ese DNI ya está cargado

#### Scenario: Profesor en Jugadores
- **WHEN** un profesor intenta dar de alta un jugador
- **THEN** el sistema lo rechaza

### Requirement: Listado y búsqueda de jugadores
La pantalla de Jugadores SHALL listar los jugadores activos del club con nombre, DNI, teléfono y correo, con búsqueda por nombre, DNI o teléfono, y un botón para agregar un jugador. Dar de baja un jugador NO SHALL borrar los turnos donde participó.

#### Scenario: Buscar por DNI
- **WHEN** se escribe "30111" en el buscador de Jugadores
- **THEN** el listado muestra los jugadores cuyo DNI contiene esos números

#### Scenario: Baja de un jugador con turnos
- **WHEN** se da de baja un jugador que figura en turnos pasados
- **THEN** deja de aparecer en Jugadores y en el buscador de personas, y los turnos siguen mostrando su nombre

### Requirement: Jugadores aislados por club
Los jugadores de un club SHALL ser visibles solo para miembros de ese club.

#### Scenario: Otro club
- **WHEN** un miembro de otro club busca personas al cargar un turno
- **THEN** no aparecen jugadores de este club

### Requirement: Jugadores en los turnos
Al cargar un turno, el buscador de personas SHALL ofrecer los jugadores del club y permitir también cargar personas que no están registradas (solo nombre). Los turnos fijos SHALL conservar la referencia a los jugadores elegidos al generar cada fecha.

#### Scenario: Turno con jugador registrado y persona nueva
- **WHEN** se carga un turno con el jugador "Mauricio Fernández" y la persona "Invitado" sin registrar
- **THEN** el turno guarda a ambos, y solo el primero queda vinculado a su ficha de Jugadores

#### Scenario: Turno fijo con jugador
- **WHEN** se crea un turno fijo con un jugador registrado y se consulta una fecha futura
- **THEN** el turno generado para esa fecha queda vinculado al mismo jugador

### Requirement: Ruta anterior de Socios
La dirección `/dashboard/socios` SHALL redirigir a `/dashboard/jugadores`.

#### Scenario: Enlace guardado
- **WHEN** alguien abre `/dashboard/socios`
- **THEN** llega a la pantalla de Jugadores
