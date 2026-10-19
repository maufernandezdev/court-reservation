## Purpose

Permite sumar personas al equipo del club compartiendo un link, sin pedir ni conocer de antemano su nombre ni su correo.

## ADDED Requirements

### Requirement: Invitar solo con rol
El `admin` SHALL generar una invitación eligiendo únicamente el rol **Operador** o **Profesor**, con una nota opcional de hasta 80 caracteres para reconocerla. El sistema NO SHALL pedir nombre ni correo, y NO SHALL permitir invitar como administrador. Solo el `admin` SHALL generar invitaciones.

#### Scenario: Generar un link
- **WHEN** el admin elige "Profesor", escribe "Juli profe" y genera la invitación
- **THEN** ve el link, un botón para enviarlo por WhatsApp y otro para copiarlo

#### Scenario: Sin administrador
- **WHEN** el admin abre el selector de rol de una invitación
- **THEN** solo ofrece Operador y Profesor

### Requirement: Link de un solo uso que vence
El link SHALL contener un código aleatorio, servir una sola vez y vencer a los 7 días. El admin SHALL poder generar un link nuevo (que invalida el anterior y renueva el vencimiento) y cancelar la invitación. Un link usado, vencido, cancelado o inexistente SHALL mostrar un mensaje que lo explique.

#### Scenario: Reuso
- **WHEN** alguien abre un link que ya se usó
- **THEN** la pantalla dice que la invitación ya se usó

#### Scenario: Link nuevo
- **WHEN** el admin genera un link nuevo para una invitación pendiente
- **THEN** el link anterior deja de servir

### Requirement: Ingreso desde el link
Quien abre el link SHALL ver el nombre del club y el rol. Sin sesión, SHALL poder crear una cuenta cargando nombre, correo y contraseña, o ingresar con una cuenta existente; con la sesión iniciada SHALL poder unirse con un botón. En todos los casos SHALL entrar al club con el rol invitado y la invitación SHALL quedar usada. Quien ya es parte del club NO SHALL poder usar el link ni consumirlo.

#### Scenario: Cuenta nueva
- **WHEN** una persona sin cuenta abre el link y carga "Juli Pérez", su correo y una contraseña
- **THEN** se crea su cuenta, entra al panel del club como profesor y su nombre figura en Equipo

#### Scenario: Cuenta existente
- **WHEN** una persona que ya tiene cuenta ingresa con su correo y contraseña desde el link
- **THEN** entra al club con el rol invitado

#### Scenario: Correo ya registrado
- **WHEN** alguien intenta crear una cuenta nueva con un correo que ya tiene cuenta
- **THEN** el sistema le indica que ingrese con su contraseña y no crea otra cuenta

#### Scenario: Ya es parte del club
- **WHEN** un miembro del club abre un link de ese mismo club con su sesión
- **THEN** el sistema le dice que ya es parte del club y el link sigue sin usarse

### Requirement: Equipo
La pantalla `/dashboard/equipo` SHALL listar a las personas del club con su rol y las invitaciones pendientes, cada una con su rol, la nota, la fecha de creación y el vencimiento, con acciones para generar un link nuevo y cancelarla. Una persona sin nombre cargado SHALL figurar por su correo con el texto "Sin nombre". `/dashboard/miembros` SHALL redirigir a `/dashboard/equipo`.

#### Scenario: Invitación pendiente
- **WHEN** hay una invitación de profesor con la nota "Juli profe"
- **THEN** Equipo la muestra como "Juli profe", rol Profesor y su vencimiento

#### Scenario: Persona sin nombre
- **WHEN** alguien entró por el link y todavía no cargó su nombre
- **THEN** Equipo la muestra con su correo y el aviso "Sin nombre"

### Requirement: Sin invitaciones por correo
La bienvenida de una cuenta sin club SHALL ofrecer crear un club o explicar que hay que pedir el link de invitación al administrador. NO SHALL listar invitaciones por correo.

#### Scenario: Cuenta sin club
- **WHEN** una persona sin club elige "Me van a invitar"
- **THEN** ve que tiene que pedirle el link al administrador y abrirlo
