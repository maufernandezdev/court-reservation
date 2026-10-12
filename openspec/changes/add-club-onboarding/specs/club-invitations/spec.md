## Purpose

Permite que el admin sume personas a su club con un link de invitación compartido por WhatsApp o copiado, y que el invitado entre al club con su correo, tenga o no una cuenta.

## ADDED Requirements

### Requirement: Crear una invitación
El `admin` SHALL poder invitar a una persona indicando nombre, correo y rol (`admin`, `operador` o `profesor`), validados antes de enviar. El sistema SHALL generar un link personal de invitación, vigente por 7 días y de un solo uso, y ofrecer "Enviar por WhatsApp" (abre WhatsApp con un mensaje que incluye el nombre del club y el link) y "Copiar link". Ningún otro rol SHALL poder invitar.

#### Scenario: Admin invita a un operador
- **WHEN** el admin carga "Juan Pérez", "juan@mail.com" y rol operador
- **THEN** el sistema crea la invitación pendiente y muestra el link con las opciones de compartir

#### Scenario: Persona que ya es miembro
- **WHEN** el admin invita un correo que ya pertenece a un miembro del club
- **THEN** el sistema no crea la invitación e indica que esa persona ya es parte del equipo

#### Scenario: Invitación pendiente repetida
- **WHEN** el admin invita un correo que ya tiene una invitación pendiente en el club
- **THEN** el sistema no crea otra e indica que puede generar un link nuevo desde la invitación existente

#### Scenario: Operador intenta invitar
- **WHEN** un operador intenta crear una invitación
- **THEN** el sistema lo rechaza

### Requirement: Gestión de invitaciones pendientes
En Equipo, el `admin` SHALL ver las invitaciones pendientes del club (nombre, correo, rol, vencimiento) y SHALL poder cancelarlas o generar un link nuevo. Generar un link nuevo SHALL invalidar el anterior y renovar el vencimiento.

#### Scenario: Cancelar una invitación
- **WHEN** el admin cancela una invitación pendiente
- **THEN** la invitación deja de aparecer como pendiente y su link ya no permite entrar al club

#### Scenario: Link nuevo
- **WHEN** el admin genera un link nuevo para una invitación
- **THEN** el link anterior deja de funcionar y el nuevo vence a los 7 días

### Requirement: Pantalla de ingreso por invitación
El link SHALL abrir una pantalla pública que muestre el nombre del club, el rol y el correo invitado, este último sin poder editarse. Si ya existe una cuenta con ese correo, SHALL pedir la contraseña; si no existe, SHALL pedir elegir una contraseña (con el mismo criterio de validación y el toggle de visibilidad del registro). Al confirmar, la persona SHALL quedar autenticada, como miembro del club con el rol invitado y dentro del panel de ese club, sin pasar por el registro ni por la verificación de correo.

#### Scenario: Invitado sin cuenta
- **WHEN** una persona sin cuenta abre el link, elige una contraseña válida y confirma
- **THEN** se crea su cuenta con el correo invitado, queda como miembro con el rol de la invitación, entra al panel del club y la invitación queda aceptada

#### Scenario: Invitado con cuenta
- **WHEN** una persona con cuenta abre el link e ingresa su contraseña correcta
- **THEN** queda como miembro con el rol de la invitación y entra al panel de ese club

#### Scenario: Contraseña incorrecta
- **WHEN** una persona con cuenta ingresa una contraseña incorrecta
- **THEN** el sistema muestra el error y no la suma al club

#### Scenario: Sesión iniciada con otra cuenta
- **WHEN** alguien con la sesión iniciada con un correo distinto al invitado abre el link
- **THEN** el sistema indica con qué cuenta está y ofrece cerrar sesión para continuar, sin sumar al club la cuenta actual

#### Scenario: Sesión iniciada con el correo invitado
- **WHEN** la persona ya tiene la sesión iniciada con el correo invitado y abre el link
- **THEN** el sistema ofrece "Unirme al club" sin pedir la contraseña

### Requirement: Links no válidos
El sistema SHALL rechazar links vencidos, cancelados, ya usados o inexistentes, indicando que hay que pedirle al administrador un link nuevo, sin revelar datos del club cuando el link no existe.

#### Scenario: Link vencido
- **WHEN** alguien abre un link de una invitación de hace más de 7 días
- **THEN** el sistema indica que la invitación venció y que hay que pedir un link nuevo

#### Scenario: Link ya usado
- **WHEN** alguien abre el link de una invitación ya aceptada
- **THEN** el sistema indica que la invitación ya se usó y ofrece ir al login

### Requirement: Auditoría de invitaciones
Crear, cancelar, regenerar y aceptar una invitación SHALL quedar registrado en la auditoría del club con la persona que lo hizo.

#### Scenario: Aceptación registrada
- **WHEN** un invitado acepta la invitación
- **THEN** la página de Actividad muestra que esa persona se unió al club con su rol
