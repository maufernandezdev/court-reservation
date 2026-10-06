## Purpose

Permite operar el club con múltiples personas (administrador, operadores y profesores), cada una con permisos acotados según su rol, reemplazando el modelo actual de usuario único.

## ADDED Requirements

### Requirement: Perfiles con roles
El sistema SHALL mantener un perfil por usuario con un rol: `admin`, `operador` o `profesor`. Todos los usuarios del mismo club SHALL compartir el acceso a las canchas y reservas del club según su rol. El creador del club SHALL ser `admin` automáticamente.

#### Scenario: Dueño existente migrado
- **WHEN** se aplica la migración sobre usuarios ya registrados
- **THEN** cada usuario existente queda como `admin` de su propio club y conserva sus canchas y reservas

### Requirement: Invitación de miembros por el admin
El sistema SHALL permitir al `admin` invitar miembros al club indicando email y rol. El sistema SHALL impedir que roles no admin gestionen miembros.

#### Scenario: Admin invita un operador
- **WHEN** el admin completa el email y el rol del nuevo miembro
- **THEN** el miembro queda registrado con ese rol y puede operar las canchas del club

#### Scenario: Operador intenta gestionar miembros
- **WHEN** un usuario con rol `operador` intenta acceder a la gestión de miembros
- **THEN** el sistema le niega el acceso y lo redirige o muestra un error

### Requirement: Permisos por rol en la operación diaria
El `operador` SHALL poder crear, editar y cobrar reservas. El `profesor` SHALL poder crear reservas para sus clases y ver sus turnos, pero NO SHALL poder eliminar turnos fuera de las políticas de cancelación (ver `cancellation-policies`). Solo el `admin` SHALL poder configurar canchas, políticas, señas y miembros.

#### Scenario: Profesor intenta borrar dentro de la ventana de penalidad
- **WHEN** un `profesor` intenta eliminar un turno que cae dentro de la ventana de penalidad configurada
- **THEN** el sistema rechaza el borrado e indica que debe solicitarlo a un administrador

#### Scenario: Operador cobra una reserva
- **WHEN** un `operador` marca una reserva como cobrada
- **THEN** el cobro queda registrado con la identidad del operador

### Requirement: Aislamiento entre clubes
Los datos de un club (canchas, reservas, miembros, configuraciones) SHALL ser visibles únicamente para usuarios con membresía en ese club, sin excepción de rol.

#### Scenario: Usuario de otro club
- **WHEN** un usuario con membresía en el club A autenticado intenta leer canchas del club B
- **THEN** el sistema no devuelve ningún dato del club B
