## Purpose

Que los profesores carguen a sus alumnos y los usen al reservar sus turnos.

## ADDED Requirements

### Requirement: Jugadores para profesores
El `profesor` SHALL ver la sección Jugadores con todos los jugadores del club, SHALL poder agregar jugadores y SHALL poder editar y dar de baja únicamente los que agregó él. El `admin` y el `operador` SHALL seguir gestionando todos. La base SHALL rechazar la edición o baja de un jugador ajeno por parte de un profesor.

#### Scenario: Agregar un alumno
- **WHEN** un profesor agrega a "Ana Gómez" en Jugadores
- **THEN** aparece en la lista y la puede elegir al crear un turno

#### Scenario: Jugador de otro
- **WHEN** un profesor mira un jugador que agregó el operador
- **THEN** lo ve en la lista, pero no tiene botones para editarlo ni darlo de baja

#### Scenario: Edición ajena rechazada
- **WHEN** un profesor intenta modificar por la API un jugador que no agregó
- **THEN** el sistema lo rechaza

#### Scenario: DNI repetido
- **WHEN** un profesor agrega un DNI que ya está cargado en el club
- **THEN** el sistema indica que ese DNI ya está cargado y el profesor puede buscar a ese jugador en la lista
