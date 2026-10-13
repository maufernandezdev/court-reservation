## Purpose

Define el valor de los turnos por tipo de cancha (tenis, pádel, fútbol) con un precio para el público y otro para profes, configurado en un solo lugar, y fija ese valor en cada turno al reservarlo.

## ADDED Requirements

### Requirement: Precios por tipo de cancha
Para cada tipo de cancha que tenga el club, el `admin` SHALL configurar en Canchas, en un solo lugar, el precio por hora para el público, el precio por hora para profes y la seña (sin seña, monto fijo o porcentaje). Todas las canchas de ese tipo SHALL usar esos valores. La cancha NO SHALL tener precio ni seña propios. Solo el `admin` SHALL modificar los precios.

#### Scenario: Tenis y pádel con distinto precio
- **WHEN** el admin configura tenis a $10.000 por hora (profe $7.000) y pádel a $5.000 (profe $4.000)
- **THEN** un turno estándar de 60 minutos en cualquier cancha de tenis vale $10.000 y uno de profe en pádel vale $4.000

#### Scenario: Tipo de cancha nuevo
- **WHEN** el admin crea la primera cancha de fútbol del club
- **THEN** aparece fútbol en Precios, sin precio configurado, hasta que el admin lo cargue

#### Scenario: Operador intenta cambiar precios
- **WHEN** un operador intenta modificar los precios
- **THEN** el sistema lo rechaza

### Requirement: Valor de cada turno
El valor de un turno SHALL calcularse como precio por hora del tipo de cancha × duración, usando el precio para profes en los turnos de profe y el precio del público en los estándar y de torneo. El valor SHALL quedar fijado en el turno al crearlo y recalcularse solo si se edita su cancha, tipo o duración. Cobros, saldo pendiente, seña, cancelaciones, Hoy y Caja SHALL usar el valor fijado.

#### Scenario: Cambio de precios con turnos ya reservados
- **WHEN** hay un turno de mañana reservado a $10.000 y el admin sube el precio de tenis a $12.000
- **THEN** ese turno sigue valiendo $10.000 y los turnos nuevos valen $12.000

#### Scenario: Torneo de 90 minutos
- **WHEN** se carga un torneo de 90 minutos en tenis a $10.000 por hora
- **THEN** el turno vale $15.000

### Requirement: Migración de precios existentes
Al aplicar el cambio, cada tipo de cancha del club SHALL tomar como precio del público y de profes el precio por hora y la seña que ya tenían configurados sus canchas, y cada turno existente SHALL fijar el valor que tenía hasta entonces.

#### Scenario: Club con canchas de tenis a $12.000
- **WHEN** se aplica el cambio en un club cuyas canchas de tenis cobraban $12.000 por hora
- **THEN** tenis queda con $12.000 para público y profes, y los turnos existentes conservan su valor
