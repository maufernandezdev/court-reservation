## Purpose

Permite alquilar la cancha por el tiempo que se necesite, en lugar de bloques fijos por cancha.

## ADDED Requirements

### Requirement: Duración elegida en cada turno
Al crear o editar un turno (estándar, de profe o de torneo) el usuario SHALL elegir la hora de inicio ("Desde") y la de fin ("Hasta"), que se completa sola con la duración por defecto al elegir o cambiar el inicio; la duración resultante es el fin menos el inicio, de 30 minutos en pasos de 30, hasta el cierre del club y como máximo 6 horas. En un turno nuevo estándar o de profe la duración SHALL arrancar en 1 hora; en uno de torneo, en la duración de torneo de Políticas. El valor del turno SHALL ser el precio por hora multiplicado por la duración, con precio de día o de noche según la hora de inicio.

#### Scenario: Una hora por defecto
- **WHEN** el operador abre "Nuevo turno" a las 20:00 en una cancha libre
- **THEN** el formulario muestra el turno de 20:00 a 21:00, con una duración de 1 hora

#### Scenario: Cambiar la duración
- **WHEN** el operador cambia la duración a 1 h 30
- **THEN** el turno ocupa de 20:00 a 21:30 y su valor es una vez y media el precio por hora

#### Scenario: Media hora
- **WHEN** el operador elige 30 minutos
- **THEN** el turno ocupa de 20:00 a 20:30 y vale la mitad del precio por hora

#### Scenario: La hora no admite una hora
- **WHEN** hay otro turno a las 20:30 y se abre "Nuevo turno" a las 20:00
- **THEN** la duración propuesta es 30 minutos y no se ofrecen duraciones mayores

#### Scenario: Torneo
- **WHEN** se crea un turno de torneo y Políticas indica 90 minutos
- **THEN** arranca en 1 h 30 y se puede cambiar como cualquier otro

### Requirement: Inicio cada 30 minutos
Un turno SHALL empezar en un horario terminado en :00 o :30 dentro del horario del club. El primer horario ofrecido para reservar en el día actual SHALL ser la próxima media hora (a las 19:44, las 20:00). El servidor SHALL rechazar un turno que empiece en otro minuto, que termine después del cierre del club o que se superponga con otro turno activo de la cancha.

#### Scenario: Primer horario de hoy
- **WHEN** son las 19:44 y el operador toca "Nuevo turno"
- **THEN** el horario propuesto es 20:00

#### Scenario: Fuera de horario
- **WHEN** un turno de 2 horas empieza a las 21:00 y el club cierra a las 22:00
- **THEN** el sistema lo rechaza porque termina después del cierre

### Requirement: Planilla y búsqueda con duración libre
La planilla SHALL mostrar los huecos libres cada 30 minutos; al tocar uno SHALL abrir el turno con 1 hora, o con lo que entre hasta el siguiente turno. El buscador "¿Hay cancha?" SHALL permitir elegir la duración buscada (arranca en 1 hora) y listar los horarios en que cabe. Hoy SHALL considerar libre un hueco de 1 hora o más.

#### Scenario: Buscar una hora y media
- **WHEN** se busca lugar para 1 h 30 desde las 20:00 y una cancha está libre de 20:00 a 21:30 y de 22:00 en adelante
- **THEN** el buscador ofrece esa cancha a las 20:00 y no a las 20:30

### Requirement: La cancha no tiene duración ni horario propios
Crear y editar una cancha SHALL pedir solo el nombre y el deporte. Las tarjetas de Canchas NO SHALL mostrar duración ni horario.

#### Scenario: Nueva cancha
- **WHEN** el admin abre "Nueva cancha"
- **THEN** el formulario pide nombre y deporte, sin duración ni horario

### Requirement: Canchas según el horario elegido
En Nueva reserva, para los tres tipos de turno (estándar, profe y torneo), el selector de cancha SHALL listar solo las canchas con lugar (al menos 30 minutos) desde el horario y la fecha elegidos. Al cambiar el horario o la fecha, si la cancha elegida ya no tiene lugar SHALL pasar a la primera libre. "Nuevo turno" SHALL abrir en la primera cancha libre desde la próxima media hora.

#### Scenario: Cancha ocupada a esa hora
- **WHEN** la Cancha 1 tiene un turno a las 09:00 y se elige 09:00 en Nueva reserva
- **THEN** la Cancha 1 no aparece en la lista y se propone la primera cancha libre

#### Scenario: Cambiar a un horario con lugar
- **WHEN** se cambia el horario a las 10:00, cuando la Cancha 1 está libre
- **THEN** la Cancha 1 vuelve a aparecer en la lista

#### Scenario: Otra fecha
- **WHEN** se cambia la fecha a un día en que otra cancha está ocupada a ese horario
- **THEN** la lista refleja las canchas libres de esa fecha
