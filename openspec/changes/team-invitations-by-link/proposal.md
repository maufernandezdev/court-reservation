> **Origen:** pedido del usuario (2026-10-18). Reemplaza lo definido en `add-club-onboarding` (invitación atada a un correo). Los permisos editables por rol van en un cambio aparte, después de este.

## Why

Hoy invitar a una persona exige cargar su nombre y su correo, y la invitación solo sirve con ese correo. En la práctica el admin comparte un link por WhatsApp y la persona usa el correo que quiera. El correo y el nombre los carga ella al registrarse y los puede cambiar después en su perfil.

## What Changes

- **La ruta pasa a `/dashboard/equipo`** (era `/dashboard/miembros`, que redirige).
- **Invitación solo con rol:** el admin elige **Operador o Profesor** y genera el link; no hay nombre ni correo. Un nuevo administrador se suma como operador y se asciende desde Equipo. Un campo opcional "Para quién es" (hasta 80 caracteres) sirve solo para reconocer cada link pendiente.
- **El link sigue siendo un código aleatorio de un solo uso que vence a los 7 días**, que el admin puede regenerar o cancelar. Se comparte por WhatsApp o copiándolo.
- **Quien abre el link** carga nombre, correo y contraseña (cuenta nueva) o ingresa con su cuenta, y entra al club con el rol invitado. Con la sesión ya iniciada, "Unirme al club" alcanza. El nombre, el correo y la foto se cambian después en Mi perfil.
- **En Equipo,** quien todavía no cargó su nombre figura por su correo con la aclaración "Sin nombre".
- **Se elimina "Me van a invitar" por correo:** la bienvenida solo explica que hay que pedir el link al administrador.

## Capabilities

### New Capabilities
- `team-invitations`: invitaciones por link con rol, ingreso sin correo previo y pantalla Equipo.

### Modified Capabilities
<!-- Las invitaciones por correo viven en `add-club-onboarding`, sin archivar: no hay spec en openspec/specs/ para un delta MODIFIED. -->

## Impact

- **Base de datos:** migración `0017_invitations_by_role.sql` (`club_invitations` pierde `email` y `full_name` y gana `note`; check para que no se invite como administrador; `get_invitation` y `accept_invitation_internal` sin correo; se eliminan `my_pending_invitations` y `accept_invitation_by_id`) y su rollback.
- **Código:** ruta y página de Equipo, acciones de invitación, pantalla pública `/invitacion/<token>` y su formulario, bienvenida, mensaje de WhatsApp, auditoría, menú, redirección y documentación.
- **Fuera de alcance:** permisos editables por rol, correo de invitación desde la app, vencimiento configurable.
