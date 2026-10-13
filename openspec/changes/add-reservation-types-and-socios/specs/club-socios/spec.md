## Purpose

Permite que el club registre a sus socios (nombre, DNI, teléfono y correo) para encontrarlos rápido al cargar un turno, sin manejar cuotas.

## ADDED Requirements

### Requirement: Registro de socios
El `admin` y el `operador` SHALL poder dar de alta, editar y dar de baja socios del club activo con nombre (obligatorio), DNI, teléfono y correo (opcionales), validados antes de guardar. El DNI, si se carga, SHALL ser único entre los socios activos del club. El sistema NO SHALL mostrar ni pedir cuota. El `profesor` NO SHALL gestionar socios.

#### Scenario: Alta de socio
- **WHEN** el admin carga "Mauricio Fernández", DNI "30111222" y teléfono "341555111"
- **THEN** el socio aparece en el listado de Socios del club

#### Scenario: DNI repetido
- **WHEN** se carga un socio con un DNI que ya tiene otro socio activo del club
- **THEN** el sistema no lo guarda e indica que ese DNI ya está cargado

#### Scenario: Profesor en Socios
- **WHEN** un profesor intenta dar de alta un socio
- **THEN** el sistema lo rechaza

### Requirement: Listado y búsqueda de socios
La pantalla de Socios SHALL listar los socios activos del club con nombre, DNI, teléfono y correo, con búsqueda por nombre, DNI o teléfono, y un botón para agregar un socio. Dar de baja un socio NO SHALL borrar los turnos donde participó.

#### Scenario: Buscar por DNI
- **WHEN** se escribe "30111" en el buscador de Socios
- **THEN** el listado muestra los socios cuyo DNI contiene esos números

#### Scenario: Baja de un socio con turnos
- **WHEN** se da de baja un socio que figura en turnos pasados
- **THEN** deja de aparecer en Socios y en el buscador de personas, y los turnos siguen mostrando su nombre

### Requirement: Socios aislados por club
Los socios de un club SHALL ser visibles solo para miembros de ese club.

#### Scenario: Otro club
- **WHEN** un miembro de otro club busca personas al cargar un turno
- **THEN** no aparecen socios de este club
