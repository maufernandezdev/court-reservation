## Purpose

Permite que quien se registra decida si da de alta su propio club o si espera a que lo inviten, y que el admin cree su club con las canchas iniciales y mantenga sus datos.

## ADDED Requirements

### Requirement: El registro no crea un club automáticamente
El sistema SHALL crear solo la cuenta cuando una persona se registra. NO SHALL crear un club ni una membresía de forma automática.

#### Scenario: Registro nuevo
- **WHEN** una persona se registra y verifica su correo
- **THEN** su cuenta existe, no es miembro de ningún club y no tiene canchas ni reservas propias

### Requirement: Elección después del registro
Una persona autenticada sin membresía en ningún club SHALL ver la pantalla de bienvenida con dos opciones: "Crear mi club" y "Me van a invitar". El sistema NO SHALL mostrarle el panel del club mientras no tenga membresía. Quien ya pertenece a un club NO SHALL poder crear otro: la bienvenida y el alta lo devuelven al panel.

#### Scenario: Entrar sin club
- **WHEN** una persona sin membresías inicia sesión o intenta abrir cualquier pantalla del panel
- **THEN** el sistema la lleva a la pantalla de bienvenida

#### Scenario: Elegir "Me van a invitar" sin invitaciones
- **WHEN** la persona elige "Me van a invitar" y no hay invitaciones pendientes para su correo
- **THEN** el sistema le indica que le pida al administrador del club el link de invitación, muestra el correo con el que tiene que invitarla y ofrece volver a la elección

#### Scenario: Elegir "Me van a invitar" con una invitación pendiente
- **WHEN** existe una invitación pendiente y vigente para el correo de la persona
- **THEN** el sistema muestra el club y el rol de esa invitación con la opción "Unirme", y al confirmarla la persona queda como miembro con ese rol y entra al panel del club

### Requirement: Alta del club con canchas iniciales
El sistema SHALL permitir dar de alta un club indicando nombre (obligatorio), ciudad (opcional) y la cantidad de canchas de cada deporte (fútbol, tenis, pádel; entre 0 y 20 por deporte, al menos una cancha en total). Al confirmar, el sistema SHALL crear en una sola operación el club, la membresía de la persona como `admin`, las políticas de cancelación por defecto y las canchas con nombres numerados y la configuración por defecto (precio 0, turnos de 60 minutos, 09:00 a 22:00, seña deshabilitada). Luego SHALL llevarla a Canchas para completar precio, duración y seña.

#### Scenario: Alta exitosa
- **WHEN** la persona completa "Club Norte", 4 canchas de tenis y 2 de pádel y confirma
- **THEN** existe el club "Club Norte" con la persona como admin y 6 canchas activas ("Cancha 1" a "Cancha 4" de tenis, "Pádel 1" y "Pádel 2"), y la persona ve la pantalla de Canchas

#### Scenario: Datos inválidos
- **WHEN** la persona confirma sin nombre o sin ninguna cancha
- **THEN** el sistema no crea nada y muestra el error junto al campo correspondiente

#### Scenario: Falla a mitad del alta
- **WHEN** falla la creación de alguna cancha durante el alta
- **THEN** no queda ni el club, ni la membresía, ni ninguna cancha creada

### Requirement: Datos del club editables por el admin
El `admin` SHALL poder editar el nombre y la ciudad del club activo. Ningún otro rol SHALL poder modificarlos.

#### Scenario: Cambio de nombre
- **WHEN** el admin cambia el nombre del club y guarda
- **THEN** el menú de todos los miembros muestra el nombre nuevo y la acción queda en la auditoría

#### Scenario: Operador intenta editar
- **WHEN** un operador intenta modificar los datos del club
- **THEN** el sistema lo rechaza

### Requirement: Migración de clubes existentes
Al aplicar el cambio, cada club con datos o con otros miembros SHALL convertirse en un club con nombre, conservando todas sus canchas, reservas, cobros, saldos, políticas, auditoría y membresías. Los clubes vacíos (sin datos y sin otros miembros) creados automáticamente al registrarse SHALL eliminarse.

#### Scenario: Club actual migrado
- **WHEN** se aplica la migración sobre el club en uso
- **THEN** el admin y los operadores ven las mismas canchas, reservas y cobros que antes, en un club llamado "Club Deportivo Central"

#### Scenario: Operador con club vacío propio
- **WHEN** se aplica la migración sobre un operador que era admin de un club vacío propio y operador del club en uso
- **THEN** queda solo como operador del club en uso

#### Scenario: Cuenta registrada sin uso
- **WHEN** se aplica la migración sobre una cuenta cuyo único club está vacío
- **THEN** la cuenta queda sin membresías y en su próximo ingreso ve la pantalla de bienvenida
