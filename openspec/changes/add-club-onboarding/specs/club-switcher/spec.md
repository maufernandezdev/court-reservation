## Purpose

Define qué club está usando cada persona, cómo cambia de club cuando pertenece a varios y garantiza que solo ve y modifica datos de ese club.

## ADDED Requirements

### Requirement: Club activo
Toda persona con al menos una membresía SHALL tener un club activo. Si no eligió ninguno, o el elegido ya no le corresponde, el club activo SHALL ser el de su membresía más reciente. El rol y los permisos aplicados SHALL ser los de su membresía en el club activo.

#### Scenario: Una sola membresía
- **WHEN** una persona que es miembro de un único club inicia sesión
- **THEN** entra a ese club con el rol de esa membresía

#### Scenario: La sacan del club activo
- **WHEN** el admin saca del equipo a una persona cuyo club activo era ese
- **THEN** en su próximo acceso entra a otro club del que siga siendo miembro, o a la pantalla de bienvenida si no le queda ninguno

### Requirement: Nombre real del club en el menú
El menú lateral y el menú del celular SHALL mostrar el nombre y las iniciales del club activo y el rol de la persona en ese club.

#### Scenario: Club recién creado
- **WHEN** la persona termina el alta de "Club Norte"
- **THEN** el menú muestra "Club Norte" y el rol Administrador

### Requirement: Cambio de club
Si la persona es miembro de más de un club, el bloque del club en el menú SHALL listar sus clubes con el rol en cada uno y permitir cambiar el club activo. Al cambiar, el panel SHALL recargar todos los datos con el club elegido. Si es miembro de un solo club, el bloque NO SHALL mostrar el selector. El menú NO SHALL ofrecer crear otro club (decisión del 2026-10-12: queda para más adelante, posiblemente en planes superiores).

#### Scenario: Cambiar de club
- **WHEN** una persona miembro de "Club Norte" (admin) y "Club Sur" (operador) elige "Club Sur"
- **THEN** ve las canchas y reservas de "Club Sur", con los permisos de operador

### Requirement: Datos limitados al club activo
Todas las pantallas y acciones SHALL leer y modificar únicamente datos del club activo (canchas, reservas, cobros, saldos, políticas, equipo, invitaciones y actividad), aunque la persona tenga acceso a otros clubes. Los datos de un club SHALL seguir siendo invisibles para quien no es miembro de ese club.

#### Scenario: Miembro de dos clubes
- **WHEN** una persona miembro de dos clubes abre la planilla con "Club Norte" activo
- **THEN** solo ve las canchas y reservas de "Club Norte"

#### Scenario: Persona ajena al club
- **WHEN** una persona sin membresía en "Club Sur" intenta leer o modificar sus datos
- **THEN** el sistema no devuelve ni modifica ningún dato de "Club Sur"
