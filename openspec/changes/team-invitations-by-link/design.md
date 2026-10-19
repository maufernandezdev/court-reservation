## Context

`club_invitations` tiene `email` y `full_name` obligatorios; el link solo sirve para esa cuenta (`accept_invitation_internal` compara el correo) y la bienvenida lista las invitaciones de cada correo (`my_pending_invitations`). La pantalla `/invitacion/<token>` muestra el correo fijo y pide solo la contraseña. La base de producción está vacía.

## Decisions

- **El código del link sigue siendo el único secreto** (32 bytes aleatorios en base64url, se guarda su sha256), de un solo uso (`for update` al aceptar) y con vencimiento a 7 días. Sin correo en la invitación es lo único que prueba que el admin la mandó.
- **Sin rol de administrador por link:** check `role <> 'admin'` (`not valid`, para no revisar filas previas) y el formulario solo ofrece operador y profesor. Un admin nuevo se suma como operador y se asciende; así un link filtrado no entrega el control del club.
- **`note` opcional** en lugar de nombre y correo: solo identifica la invitación para el admin; no se copia a la cuenta.
- **Cuenta nueva desde el link:** la acción crea el usuario con la API de administración (`SUPABASE_SECRET_KEY`), ya confirmado, con el nombre en `user_metadata` (de ahí sale el perfil), inicia sesión y acepta. El correo no se verifica en ese momento; para cambiarlo después, Mi perfil exige la confirmación por correo. Si el correo ya tiene cuenta, se indica que ingrese con su contraseña (`email_exists`). Se acepta el riesgo de una cuenta con un correo ajeno o mal escrito a cambio de que sumarse sea un solo paso.
- **Cuenta existente:** el formulario del link tiene dos modos (cuenta nueva / ya tengo cuenta); con la sesión iniciada solo se ofrece "Unirme al club" (más "usar otra cuenta").
- **`accept_invitation_internal`** toma el correo de la sesión y el nombre del perfil para crear la membresía; rechaza con "Ya sos parte de este club" sin consumir el link si ya es miembro. Se eliminan `my_pending_invitations` y `accept_invitation_by_id`, y `get_invitation` deja de devolver correo, nombre y `has_account`.
- **Equipo:** la ruta se renombra con redirección en `next.config.ts`; los textos y componentes se actualizan (`components/members` conserva su carpeta). La matriz de permisos queda como está.

## Risks / Trade-offs

- [Un link compartido por error lo usa cualquiera] → de un solo uso, vence a los 7 días, se puede cancelar y no da rol de administrador.
- [Cuenta creada con un correo no verificado] → ver arriba; el cambio de correo posterior sí se confirma.

## Migration Plan

1. Escribir `0017_invitations_by_role.sql` y su rollback; probar subir → bajar → subir en local, y aceptar un link con un correo cualquiera.
2. Cambiar código y pantallas y verificar el flujo completo en el navegador.
3. Aplicar en la base real (vacía) y desplegar junto con el código.
