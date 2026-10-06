## Purpose

Hace que la planilla de reservas sea plenamente operable desde un teléfono móvil (consultar ocupación, crear, editar, cobrar y cancelar turnos) y agrega un buscador rápido de disponibilidad para atender consultas en segundos.

## ADDED Requirements

### Requirement: Planilla usable en pantallas pequeñas
En pantallas móviles la planilla SHALL ofrecer una vista adaptada (por cancha, con navegación entre franjas horarias) que permita crear, editar, cobrar y cancelar reservas sin scroll horizontal. En desktop SHALL conservarse la vista grid de canchas × horarios.

#### Scenario: Operación desde el celular
- **WHEN** un operador abre la planilla desde un teléfono
- **THEN** puede recorrer las canchas y horarios del día y realizar todas las acciones de reserva sin desplazamiento horizontal

### Requirement: Buscador rápido de disponibilidad
El sistema SHALL ofrecer una búsqueda express de turnos libres por fecha, franja horaria opcional y tipo de cancha, mostrando las franjas disponibles ordenadas por hora.

#### Scenario: Consulta telefónica
- **WHEN** el operador busca disponibilidad para "mañana a la tarde en pádel"
- **THEN** el sistema lista las franjas libres de canchas de pádel ordenadas por horario

#### Scenario: Día completo
- **WHEN** el operador busca sin indicar franja ni tipo
- **THEN** el sistema muestra todas las canchas con sus ocupaciones del día, resaltando los turnos libres
