## Purpose

Define la navegación y el marco común del panel del club en escritorio y en celular, respetando los permisos de cada rol.

## ADDED Requirements

### Requirement: Menú lateral agrupado en escritorio
En pantallas anchas el panel SHALL mostrar un menú lateral oscuro con el logo del producto, un bloque del club (nombre y rol del usuario) y los ítems agrupados en "Operación" (Hoy, Planilla, Caja), "Club" (Canchas, Socios, Equipo, Productos) y "Administración" (Políticas, Actividad, Reportes, Notificaciones, Suscripción). El ítem de la sección actual MUST destacarse con fondo pelota y marcarse como página actual para tecnologías asistivas. Las URLs existentes MUST mantenerse (Planilla = `/dashboard/reservas`, Equipo = `/dashboard/miembros`, Políticas = `/dashboard/configuracion`).

#### Scenario: Sección activa
- **WHEN** el usuario está en `/dashboard/reservas`
- **THEN** el ítem "Planilla" aparece destacado y el resto no

#### Scenario: URL vieja
- **WHEN** alguien abre un link guardado a `/dashboard/miembros`
- **THEN** ve la pantalla Equipo sin error

### Requirement: Visibilidad por rol
El menú SHALL mostrar a operadores y profesores solo los ítems que su rol puede usar, con las mismas reglas que hoy (los ítems solo-admin siguen ocultos para no-admins), incluyendo la nueva página Actividad como solo-admin.

#### Scenario: Operador
- **WHEN** inicia sesión un operador
- **THEN** ve Hoy y Planilla, y no ve Equipo, Políticas ni Actividad

### Requirement: Usuario y cierre de sesión
El menú SHALL mostrar al usuario actual (iniciales, nombre o email) y un botón de cerrar sesión accesible con nombre ("Cerrar sesión").

#### Scenario: Cerrar sesión
- **WHEN** el usuario toca "Cerrar sesión"
- **THEN** se cierra la sesión y vuelve al login

### Requirement: Navegación en celular
En pantallas angostas el panel SHALL reemplazar el menú lateral por una barra inferior fija con Hoy, Planilla, Buscar, Caja y "Más"; "Más" MUST abrir el resto de las secciones permitidas para el rol, el club y el cierre de sesión. Todos los objetivos táctiles MUST medir al menos 44 px.

#### Scenario: Ir a la planilla desde el celular
- **WHEN** en un celular el usuario toca "Planilla" en la barra inferior
- **THEN** se abre la planilla y "Planilla" queda destacado en la barra

#### Scenario: Secciones secundarias
- **WHEN** un admin toca "Más"
- **THEN** ve Canchas, Equipo, Políticas, Actividad y demás secciones permitidas, y la opción de cerrar sesión
