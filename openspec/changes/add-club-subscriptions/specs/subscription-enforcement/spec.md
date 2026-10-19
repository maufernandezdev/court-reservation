## Purpose

Hace cumplir las condiciones de la suscripción: no deja superar la cantidad de canchas del plan y pasa el club a solo lectura cuando no pagó, sin bloquearle nunca el acceso a sus datos.

## ADDED Requirements

### Requirement: Límite de canchas del plan
El sistema SHALL impedir crear o reactivar una cancha cuando las canchas activas del club ya alcanzan el límite de su plan. Las canchas dadas de baja NO SHALL contar. El mensaje SHALL indicar el límite del plan y que hay que pasar a uno mayor. El plan Gran Club NO SHALL tener tope.

#### Scenario: Cuarta cancha en plan Inicial
- **WHEN** un club con plan Inicial y 3 canchas activas intenta crear una cuarta
- **THEN** el sistema no la crea e indica que el plan incluye hasta 3 canchas

#### Scenario: Cancha dada de baja
- **WHEN** un club con plan Inicial y 3 canchas activas da de baja una y crea otra
- **THEN** la nueva se crea

#### Scenario: Reactivar por encima del límite
- **WHEN** un club con plan Inicial, 3 canchas activas y una dada de baja intenta reactivar esa cancha
- **THEN** el sistema lo rechaza por el límite del plan

#### Scenario: Plan sin tope
- **WHEN** un club con plan Gran Club crea su cancha número 12
- **THEN** se crea sin restricción

### Requirement: Solo lectura al vencer la suscripción
Cuando el estado del club es "vencido", el sistema SHALL permitir ver todos sus datos y SHALL rechazar cualquier alta o modificación de turnos, turnos fijos, cobros, saldos, canchas, precios, políticas, jugadores, equipo e invitaciones, con un mensaje que explique que la suscripción está vencida y que solo se puede consultar. En prueba, al día y en gracia el club SHALL operar sin restricciones. El inicio de sesión, la lectura y la edición del perfil personal NO SHALL bloquearse. Registrar un pago aprobado SHALL devolver la escritura de inmediato.

#### Scenario: Club vencido intenta reservar
- **WHEN** un operador de un club vencido intenta crear un turno
- **THEN** el sistema lo rechaza con el aviso de suscripción vencida

#### Scenario: Club vencido consulta
- **WHEN** el admin de un club vencido abre la planilla, Caja y Actividad
- **THEN** ve toda su información

#### Scenario: Club en gracia
- **WHEN** un club en gracia crea un turno
- **THEN** se crea normalmente y el panel muestra el aviso de gracia

#### Scenario: Regularización
- **WHEN** se registra un pago aprobado de un club vencido
- **THEN** el club puede volver a crear turnos sin cerrar sesión

#### Scenario: Perfil personal
- **WHEN** un usuario de un club vencido cambia su foto o su contraseña
- **THEN** el cambio se guarda

### Requirement: Club independiente de otros
El estado de la suscripción de un club SHALL afectar solo a ese club. Una persona que pertenece a dos clubes SHALL poder operar en el que está al día aunque el otro esté vencido.

#### Scenario: Persona en dos clubes
- **WHEN** una persona del club A (vencido) y del club B (al día) crea un turno en B
- **THEN** se crea normalmente
