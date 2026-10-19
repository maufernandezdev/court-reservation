## Purpose

El club tiene un logo que el administrador carga y que todo el equipo ve en el menú.

## ADDED Requirements

### Requirement: Logo del club
El `admin` SHALL poder subir, cambiar y quitar el logo del club desde Políticas. El logo SHALL aceptar JPG, PNG o WebP de hasta 5 MB y guardarse sin sus bordes vacíos y conservando su forma (un logo horizontal NO SHALL quedar dentro de un cuadrado con franjas). Los demás roles NO SHALL modificarlo.

#### Scenario: Subir el logo
- **WHEN** el admin elige una imagen válida en "Logo del club"
- **THEN** el logo queda guardado y se ve en el bloque del club del menú

#### Scenario: Imagen no válida
- **WHEN** el admin elige un archivo que no es JPG, PNG o WebP, o que pesa más de 5 MB
- **THEN** el sistema lo rechaza con un mensaje y no cambia el logo

#### Scenario: Quitar el logo
- **WHEN** el admin toca "Quitar logo"
- **THEN** el bloque del club vuelve a mostrar las iniciales

### Requirement: Logo visible para el equipo
Todos los miembros del club (admin, operador y profesor) SHALL ver el logo en el bloque del club del menú, en escritorio y en celular, y en el selector de club. Sin logo SHALL verse las iniciales del nombre. El logo SHALL servirse solo a personas con sesión que pertenecen a ese club.

#### Scenario: Operador
- **WHEN** un operador entra al panel de un club con logo
- **THEN** ve el logo en el bloque del club

#### Scenario: Persona de otro club
- **WHEN** alguien que no pertenece al club pide la dirección del logo
- **THEN** no obtiene la imagen
