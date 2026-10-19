## 1. Base de datos

- [x] 1.1 Migración `0017_invitations_by_role.sql` y `supabase/rollback/0017_down.sql`; probar subir → bajar → subir en local, que un link se acepta con un correo cualquiera, que no se reusa y que no se puede invitar como administrador

## 2. Equipo e invitaciones

- [x] 2.1 Renombrar la ruta a `/dashboard/equipo` (página, acciones, menú, `revalidatePath`) con redirección desde `/dashboard/miembros`
- [x] 2.2 `lib/members.ts` y `lib/invitations.ts` (rol y nota, mensaje de WhatsApp sin nombre ni correo), acciones de crear, regenerar y cancelar sin correo, auditoría y Actividad
- [x] 2.3 Pantalla Equipo: diálogo "Invitar al equipo" con rol y nota, lista de invitaciones pendientes y miembros "Sin nombre"

## 3. Ingreso desde el link

- [x] 3.1 `/invitacion/<token>` y su formulario: cuenta nueva (nombre, correo, contraseña), cuenta existente, y botón con sesión iniciada; acciones del servidor
- [x] 3.2 Bienvenida: sacar las invitaciones por correo y explicar que hay que pedir el link al administrador

## 4. Verificación y cierre

- [x] 4.1 Verificar en el navegador a 1440 y 390 px: invitar, copiar y WhatsApp, abrir el link con cuenta nueva y con cuenta existente, reuso, vencido, cancelado, regenerado, ya miembro, correo ya registrado, y que `/dashboard/miembros` redirige
- [x] 4.2 `pnpm exec tsc --noEmit` y `pnpm build` pasan; actualizar README y `docs/PROJECT_DOCUMENTATION.md` y agregar la prueba manual a `docs/next-steps.md`
- [x] 4.3 Aplicar `0017` en la base real y verificar la tabla — aplicada el 2026-10-18
