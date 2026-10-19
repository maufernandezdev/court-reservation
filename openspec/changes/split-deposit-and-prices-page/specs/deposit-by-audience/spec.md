## Purpose

Permite pedir seña solo a quien corresponde: el club inicial no la pide al público y sí a los profesores.

## ADDED Requirements

### Requirement: Seña del público y seña de profes
Para cada tipo de cancha del club, el `admin` SHALL configurar por separado la seña del **público** y la de **profes**. Cada una SHALL tener un interruptor "Pedir seña", un tipo (monto fijo o porcentaje del valor del turno) y un valor. La del público SHALL arrancar apagada. Solo el `admin` SHALL modificarlas.

#### Scenario: Seña solo para profes
- **WHEN** el admin deja apagada la seña del público y enciende la de profes en tenis con 50 %
- **THEN** un turno estándar de tenis no pide seña y un turno de profe de tenis pide el 50 % de su valor

#### Scenario: Club que ya tenía seña configurada
- **WHEN** se aplica el cambio en un club con seña cargada
- **THEN** la seña de profes toma esa configuración y la del público queda apagada

### Requirement: A qué turnos se aplica cada seña
Los turnos estándar y de torneo SHALL usar la seña del público; los turnos de profe, la de profes. La seña SHALL calcularse sobre el valor del turno (de día o de noche según su hora de inicio) y el cobro de seña SHALL ofrecerse solo si la que corresponde al turno está encendida.

#### Scenario: Cobro de seña en un turno estándar
- **WHEN** el operador abre un turno estándar de una cancha sin seña del público
- **THEN** no se ofrece cobrar seña y el aviso dice que esa cancha no tiene seña configurada

#### Scenario: Turno de profe con seña por porcentaje
- **WHEN** se reserva un turno de profe de $7.000 con seña del 30 %
- **THEN** el formulario y el detalle del turno muestran una seña de $2.100
