## Purpose

Permite que cada persona del club (admin, operador o profesor) mantenga sus propios datos —nombre, correo, contraseña, foto y, si es profe, su color en la planilla— desde una pantalla de perfil.

## ADDED Requirements

### Requirement: Pantalla de perfil
Toda persona con sesión SHALL poder abrir "Mi perfil" desde el bloque de usuario del menú (lateral y del celular), en `/dashboard/perfil`, sin importar su rol. La pantalla SHALL mostrar su foto o iniciales, su nombre, su correo y los clubes a los que pertenece con su rol.

#### Scenario: Operador abre su perfil
- **WHEN** un operador toca su nombre en el menú
- **THEN** ve "Mi perfil" con su nombre, su correo y su rol en el club

### Requirement: Cambiar el nombre
La persona SHALL poder cambiar su nombre (obligatorio, hasta 120 caracteres). El nombre nuevo SHALL verse en el menú, en Equipo y en Actividad de todos sus clubes.

#### Scenario: Nombre nuevo
- **WHEN** Laura cambia su nombre a "Laura Sosa"
- **THEN** el menú muestra "Laura Sosa" y el admin la ve así en Equipo

#### Scenario: Nombre vacío
- **WHEN** intenta guardar el nombre vacío
- **THEN** el sistema no lo guarda e indica que el nombre es obligatorio

### Requirement: Cambiar la contraseña
La persona SHALL poder cambiar su contraseña ingresando la actual y la nueva dos veces, con la misma regla que el registro (al menos 6 caracteres) y el toggle de visibilidad. Si la contraseña actual es incorrecta, el sistema NO SHALL cambiarla.

#### Scenario: Cambio correcto
- **WHEN** ingresa la contraseña actual correcta y una nueva válida repetida igual
- **THEN** la contraseña cambia y la próxima vez ingresa con la nueva

#### Scenario: Contraseña actual incorrecta
- **WHEN** la contraseña actual no es la correcta
- **THEN** el sistema indica que la contraseña actual no es correcta y no cambia nada

### Requirement: Cambiar el correo
La persona SHALL poder pedir un cambio de correo. El sistema SHALL enviar un link de confirmación al correo nuevo y, hasta confirmarlo, el correo anterior SHALL seguir siendo el válido para ingresar. Al confirmarlo, el correo nuevo SHALL verse en Equipo de todos sus clubes. El sistema SHALL rechazar un correo que ya usa otra cuenta.

#### Scenario: Pedido de cambio
- **WHEN** pide cambiar su correo a "nuevo@mail.com"
- **THEN** el perfil indica que falta confirmar desde el correo nuevo y sigue ingresando con el anterior

#### Scenario: Confirmación
- **WHEN** abre el link de confirmación
- **THEN** su correo pasa a ser "nuevo@mail.com" y así figura en Equipo

### Requirement: Foto de perfil
La persona SHALL poder subir una foto (JPG, PNG o WebP de hasta 5 MB), que el sistema guarda recortada en cuadrado y reducida, cambiarla o quitarla. La foto SHALL verse en Mi perfil, en el bloque de usuario del menú y en Equipo. Las fotos SHALL ser visibles solo para personas con sesión que compartan un club con su dueño. Sin foto SHALL verse las iniciales.

#### Scenario: Subir foto
- **WHEN** sube una foto de 3 MB
- **THEN** su foto aparece en el menú y en Equipo

#### Scenario: Archivo no permitido
- **WHEN** intenta subir un PDF o una imagen de 8 MB
- **THEN** el sistema la rechaza e indica el formato y el tamaño permitidos

#### Scenario: Persona ajena al club
- **WHEN** alguien sin un club en común pide la foto de esa persona
- **THEN** el sistema no la muestra

#### Scenario: Quitar foto
- **WHEN** quita su foto
- **THEN** vuelven a verse sus iniciales

### Requirement: Color del profe desde su perfil
Una persona con rol `profesor` SHALL poder elegir, desde su perfil, su color en la planilla de cada club donde es profe, dentro de la paleta del sistema. El `admin` SHALL seguir pudiendo cambiarlo desde Equipo. Quien no es profe NO SHALL ver esta opción.

#### Scenario: Profe elige su color
- **WHEN** un profe elige el color violeta en su perfil
- **THEN** sus turnos de profe se ven violetas en la planilla de ese club

#### Scenario: Operador
- **WHEN** un operador abre su perfil
- **THEN** no ve la opción de color
