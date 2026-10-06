## Purpose

Permite al club definir el valor de cada cancha, la duración de los turnos, los horarios de apertura y la configuración de seña (activación, monto fijo o porcentaje) para que la operación y los futuros cobros tengan una base de negocio real.

## ADDED Requirements

### Requirement: Configuración de precio por cancha
El sistema SHALL permitir definir un precio por hora para cada cancha, obligatorio y mayor a cero, expresado en la moneda local (ARS). El precio SHALL ser visible en la planilla de reservas.

#### Scenario: Alta de cancha con precio
- **WHEN** el usuario crea una cancha completando nombre, tipo, precio y demás campos obligatorios
- **THEN** la cancha se guarda con el precio configurado y aparece en la planilla

#### Scenario: Precio inválido
- **WHEN** el usuario ingresa un precio menor o igual a cero o lo deja vacío
- **THEN** el sistema muestra un error en español y no guarda la cancha

### Requirement: Duración de turno configurable
El sistema SHALL permitir configurar la duración del turno por cancha con opciones de 30, 60 y 90 minutos. La grilla de la planilla SHALL respetar la duración configurada de cada cancha.

#### Scenario: Cancha con turnos de 30 minutos
- **WHEN** una cancha tiene duración de 30 minutos
- **THEN** la planilla muestra franjas de 30 minutos para esa cancha

#### Scenario: Duración por defecto
- **WHEN** el usuario no elige duración al crear la cancha
- **THEN** la cancha usa 60 minutos como valor por defecto

### Requirement: Horarios de apertura por cancha
El sistema SHALL permitir configurar horario de apertura y cierre por cancha, y la planilla SHALL solo ofrecer franjas dentro de ese rango.

#### Scenario: Reserva fuera de horario
- **WHEN** se intenta crear una reserva en una franja fuera del horario de apertura de la cancha
- **THEN** el sistema rechaza la operación e informa el horario permitido

### Requirement: Configuración de seña por cancha
El sistema SHALL permitir activar o desactivar la seña por cancha, y definirla como monto fijo o porcentaje del valor del turno. El monto resultante de una seña porcentual SHALL calcularse sobre el precio de la duración del turno.

#### Scenario: Seña porcentual
- **WHEN** una cancha tiene precio $10.000/hora, turnos de 60 min y seña del 30% habilitada
- **THEN** la seña de cada turno es de $3.000 y se muestra en la reserva

#### Scenario: Seña deshabilitada
- **WHEN** la seña de una cancha está deshabilitada
- **THEN** las reservas de esa cancha no requieren seña ni muestran monto de seña

#### Scenario: Seña mayor al turno
- **WHEN** el usuario configura una seña cuyo monto calculado supera el valor del turno
- **THEN** el sistema muestra un error y no guarda la configuración
