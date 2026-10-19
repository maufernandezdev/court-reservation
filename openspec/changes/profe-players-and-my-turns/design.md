## Context

Los turnos de profe tienen `kind = 'profe'` y `profe_user_id`, y los miembros leen las reservas del club. `players` permite alta y edición solo al staff (`is_staff`); la página y las acciones de Jugadores piden rol de operador. El menú se filtra por rol mínimo.

## Decisions

- **Políticas de `players`:** insertar lo permite cualquier miembro del club con `created_by = auth.uid()` (las acciones ya lo guardan); actualizar (incluida la baja lógica) lo permite el staff o quien lo agregó. Leer sigue abierto a los miembros: el profe necesita ver a todos para no duplicar y para buscarlos al reservar.
- **Jugadores en el código:** las acciones piden el rol mínimo `profesor` (cualquier miembro) y, si quien actúa es profesor, filtran editar y dar de baja por `created_by`. La página muestra los botones de cada fila solo si puede editarla (`created_by` propio o rol de staff).
- **Mis turnos como Server Component** con la vista en la URL (`?vista=hoy|semana|historial`, más `?semana=<fecha>` y `?mes=AAAA-MM`), como Caja y Reportes. Las lecturas filtran `profe_user_id = <profesor>` y el club activo; los cálculos de fechas son funciones puras en `lib/my-turns.ts`, en horario de Buenos Aires.
- **Fijos futuros:** antes de leer la semana se llama a `ensureFixedReservations` hasta el domingo de esa semana (genera las fechas que falten, idempotente).
- **Menú por rol exacto:** `NavItem` suma `roles` (lista de roles que lo ven) para "Mis turnos", que solo ve el profesor; en celular ocupa el lugar de Caja para ese rol.
- **Solo lectura:** cobrar, cancelar o editar un turno sigue siendo desde la planilla (donde el profe ya tiene sus reglas).

## Risks / Trade-offs

- [El profe ve jugadores de otros profes] → es un directorio del club (ya lo ve al buscar al reservar); solo puede modificar los suyos.
- [Jugadores cargados por un operador no los puede corregir el profe] → lo pide al operador, igual que hoy con lo que no es suyo.

## Migration Plan

1. `0019_profe_players.sql` y su rollback; probar con un profe y un operador en el Supabase local.
2. Implementar y verificar en el navegador a 1440 y 390 px.
3. Aplicar en la base real (cambio de políticas, sin datos).
