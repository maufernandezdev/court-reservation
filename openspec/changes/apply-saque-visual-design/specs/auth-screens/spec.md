## Purpose

Define la presentación de las pantallas de acceso (login, registro y verificación de cuenta) con la identidad de la marca, sin cambiar el flujo de autenticación existente.

## ADDED Requirements

### Requirement: Login con panel de marca
La pantalla de login SHALL mostrar un panel de marca (logo, frase principal y dibujo de cancha) junto al formulario de email y contraseña. En celular el panel de marca MUST reducirse para que el formulario quede visible sin desplazarse. El flujo de autenticación, la validación con Zod y la redirección al panel MUST comportarse igual que antes.

#### Scenario: Credenciales inválidas
- **WHEN** el usuario ingresa un email o contraseña incorrectos
- **THEN** se muestra un mensaje de error en español arriba del formulario, anunciado a lectores de pantalla, y los datos ingresados se conservan

#### Scenario: Envío en curso
- **WHEN** el usuario envía el formulario
- **THEN** el botón muestra "Ingresando…" y queda deshabilitado hasta tener respuesta

### Requirement: Contraseña con toggle de visibilidad
Todo campo de contraseña de las pantallas de acceso SHALL tener un botón para mostrar u ocultar el texto, con nombre accesible que refleje la acción ("Mostrar contraseña" / "Ocultar contraseña").

#### Scenario: Mostrar contraseña
- **WHEN** el usuario toca el ojo del campo contraseña
- **THEN** el texto se vuelve visible y el botón pasa a llamarse "Ocultar contraseña"

### Requirement: Registro con la misma identidad
La pantalla de registro SHALL usar la misma estructura visual que el login, con errores de validación por campo debajo de cada input, y MUST conservar los campos, reglas y flujo de verificación por email actuales.

#### Scenario: Email inválido
- **WHEN** el usuario escribe un email sin dominio válido y envía
- **THEN** el campo email se marca en error y debajo aparece "Ingresá un email válido"

### Requirement: Verificación de cuenta con la misma identidad
La pantalla de verificación de cuenta SHALL usar la identidad de la marca y conservar su comportamiento actual (instrucciones, reenvío de email con sus límites y vuelta al login).

#### Scenario: Llegada después de registrarse
- **WHEN** el usuario termina el registro
- **THEN** ve la pantalla de verificación con la marca y las instrucciones para confirmar su email
