## 1. Base de datos

- [x] 1.1 Migración `0019_profe_players.sql` (insertar: cualquier miembro con `created_by = auth.uid()`; actualizar: staff o quien lo agregó) y `supabase/rollback/0019_down.sql`; probar subir → bajar → subir y que un profe no pueda modificar un jugador ajeno

## 2. Jugadores para profesores

- [x] 2.1 Acciones de Jugadores con rol mínimo `profesor` y filtro por `created_by` al editar o dar de baja siendo profe; página visible para el profe con botones solo en sus jugadores; menú de Jugadores para todos los roles

## 3. Mis turnos

- [x] 3.1 `lib/my-turns.ts` (lunes de una semana, días de la semana, mes y totales) con pruebas de las funciones
- [x] 3.2 Ruta `/dashboard/mis-turnos` con las vistas Hoy, Semana e Historial; entrada solo para profesores en el menú y en la barra inferior del celular (lugar de Caja)

## 4. Cancelación del profesor y leyenda

- [x] 4.1 Migración `0020_profe_cancellation.sql` (`cancel_own_profe_reservation`), acción y modal con aceptación de la penalidad, y leyenda de la planilla sin "Señada" (si no hay seña) ni "Cancelada"; verificar por SQL (en término, tarde sin aceptar, con seña, turno ajeno, API directa) y en el navegador

## 5. Verificación y cierre

- [x] 5.1 Verificar en el navegador a 1440 y 390 px: el profe agrega un alumno y lo usa en un turno, no edita el de otro, ve sus turnos en las tres vistas (incluido un fijo en una semana futura), y el admin y el operador no ven la sección
- [x] 5.2 `pnpm exec tsc --noEmit` y `pnpm build` pasan; actualizar README y `docs/PROJECT_DOCUMENTATION.md`; agregar la prueba manual a `docs/next-steps.md`
- [x] 5.3 Aplicar `0019` y `0020` en la base real y verificar las políticas — aplicadas el 2026-10-18
