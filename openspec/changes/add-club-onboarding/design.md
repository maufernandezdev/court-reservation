## Context

- El "club" es hoy el id del usuario dueño: `memberships.owner_id`, `courts.user_id`, `reservations.user_id`, y `owner_id` en `payments`, `settings`, `credit_balances` y `audit_log`. Las policies de RLS usan `is_member(owner)`, `is_admin(owner)` e `is_staff(owner)`, todas `SECURITY DEFINER` sobre `memberships`.
- El trigger `handle_new_user` crea una membresía `admin` por cada usuario nuevo. La invitación actual (`inviteMemberAction`) busca un usuario ya registrado con `find_user_id_by_email` e inserta la membresía.
- El club activo se elige como "membresía más reciente" en dos lugares: `getSessionContext` (servidor, `lib/auth.ts`) y `useMembership` (cliente).
- La mayoría de las lecturas del cliente (`hooks/use-courts.ts`, `use-reservations.ts`, `use-day-payments.ts`, el buscador) **no filtran por club**: confían en el RLS. Con una sola membresía real eso alcanza; con dos clubes mezclaría datos.
- Supabase Auth tiene activada la confirmación de correo, y el SMTP es el de prueba (solo entrega a direcciones del equipo). No hay clave secreta (service role) configurada; el proyecto usa el sistema nuevo de claves (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), así que la del servidor es la secret key (`SUPABASE_SECRET_KEY`).
- Next.js 16: `proxy.ts` en lugar de `middleware.ts`, `params`/`searchParams` asíncronos. Releer `node_modules/next/dist/docs/` antes de crear rutas dinámicas.
- Canvas de referencia: artboard `AltaClub` en https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF (paso 2 de 3: datos del club, chips de deportes con contador de canchas y vista previa "Tu planilla"). No hay artboards para la bienvenida, la invitación ni el selector: se construyen con el lenguaje visual de `Registro`/`Main` (panel de marca + formulario) y del shell.

## Goals / Non-Goals

**Goals:**
- Que el id del club deje de ser el id de una persona, sin perder ni remapear datos existentes.
- Que toda lectura y escritura quede atada al club activo de forma explícita, además del RLS.
- Que el invitado entre con su correo sin depender del envío de correos.
- Usar la service role key solo en un punto acotado (crear la cuenta del invitado).

**Non-Goals:**
- Enviar correos desde la app (invitación o avisos).
- Transferir la propiedad de un club, borrar clubes o abandonar un club por cuenta propia.
- Deportes nuevos (squash, vóley, "otro" del canvas): solo los tres tipos que hoy admite `courts.type`.
- Superficie de cancha (`add-court-surface`, postergado).

## Decisions

### 1. Tabla `clubs` reutilizando el id del dueño actual
`clubs(id uuid pk default gen_random_uuid(), name text not null, city text not null default '', created_by uuid references auth.users on delete set null, created_at)`. En la migración, cada club existente se inserta con `id = owner_id`, así **ninguna fila de datos cambia de valor**: solo se renombra la columna y se cambia la FK de `auth.users` a `clubs`.
- Alternativa: ids nuevos y `UPDATE` masivo de todas las tablas. Más riesgo y sin beneficio.
- Alternativa: no renombrar y dejar `owner_id`. Menos cambios, pero sigue sugiriendo que el club es una persona, que es justo la confusión que se quiere eliminar.

### 2. Renombrar a `club_id` en todas las tablas del club
`memberships.owner_id`, `courts.user_id`, `reservations.user_id`, y `owner_id` de `payments`, `settings`, `credit_balances` y `audit_log` pasan a `club_id` con FK a `clubs(id) on delete cascade`. Las funciones `is_member/is_admin/is_staff` se recrean con parámetro `p_club_id`, se recrean las policies afectadas y se ajustan `check_reservation_court_owner`, `adjust_credit_balance` y `protect_reservation_money` si referencian las columnas viejas. El tipo `Membership` pasa a tener `club_id` y `club: { name, city }`.
- Se hace en una sola migración (`0007_clubs_and_invitations.sql`) dentro de una transacción, para que no quede un estado intermedio.

### 3. Limpieza de clubes fantasma en la migración
Antes de crear `clubs`, se borran las membresías `owner_id = user_id` cuyo "club" no tiene canchas, reservas, cobros, saldos, políticas, auditoría ni otros miembros. Eso incluye el club vacío del operador de prueba y los de cuentas registradas que nunca usaron la app (relevamiento del 2026-10-12: 6 clubes vacíos sobre 8). Esas personas, si no son miembros de otro club, pasan por la bienvenida en su próximo ingreso. Los clubes que sobreviven toman el nombre "Club Deportivo Central" (el valor de `CLUB_NAME`), editable después en Políticas.

### 4. Alta del club atómica con `create_club` (RPC)
Función `SECURITY DEFINER` `create_club(p_name text, p_city text, p_courts jsonb)` para usuarios autenticados: valida los datos, inserta el club, la membresía `admin` de `auth.uid()`, la fila de `settings` por defecto, las canchas numeradas ("Cancha N" para tenis, "Pádel N" para pádel y "Fútbol N" para fútbol, como la vista previa del canvas) y la auditoría `club.created`, y devuelve el id. Todo dentro de la misma función, así que falla o se crea completo.
- Alternativa: varios `insert` desde la Server Action. No es atómico con supabase-js y el RLS de `courts` exige ser admin, que todavía no se es hasta insertar la membresía.
- La Server Action valida con Zod (mismo schema que el formulario) antes de llamar a la RPC.

### 5. Invitaciones con token aleatorio guardado como hash
`club_invitations(id, club_id, email (minúsculas), full_name, role, token_hash text unique, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)`, con índice único parcial `(club_id, email) where accepted_at is null and revoked_at is null`. El token son 32 bytes aleatorios en base64url, generados en el servidor; en la base solo queda `sha256(token)`. El link es `${origen}/invitacion/<token>`. RLS: solo `is_admin(club_id)` lee y escribe.
- Consecuencia: el link solo se muestra al crear o regenerar la invitación. "Generar link nuevo" reemplaza el hash y renueva `expires_at` (así se cumple que el link viejo deja de servir).
- Alternativa: guardar el token en claro para poder recopiarlo. Más cómodo, pero cualquier lectura de la tabla filtraría links válidos.

### 6. Lectura pública de la invitación y aceptación por RPC
- `get_invitation(p_token text)`: `SECURITY DEFINER`, ejecutable por `anon` y `authenticated`. Hashea el token y devuelve solo `status` (`pending | expired | accepted | revoked`), nombre del club, rol, correo, nombre y `has_account` (si existe un usuario con ese correo). Si el token no existe devuelve `status = 'invalid'` y nada más. Así la página pública no necesita service role ni abrir la tabla al `anon`.
- `accept_invitation(p_token text)`: `SECURITY DEFINER`, solo `authenticated`. Verifica que esté pendiente y vigente y que `lower(auth.jwt() ->> 'email')` coincida con el correo invitado; inserta la membresía (si ya era miembro, no duplica ni cambia el rol), marca `accepted_at/accepted_by`, escribe `invitation.accepted` en la auditoría y devuelve `club_id`. Bloquea la fila (`for update`) para que el link sea de un solo uso aunque se use dos veces a la vez.
- `my_pending_invitations()`: invitaciones pendientes y vigentes para el correo del usuario autenticado (club, rol), para la opción "Me van a invitar". Para aceptar desde ahí se usa una variante `accept_invitation_by_id(p_id)` con la misma verificación de correo (el token no está disponible fuera del link).

### 7. Cuenta del invitado creada ya confirmada, con service role solo en el servidor
Para "Invitado sin cuenta", la Server Action `joinWithInvitationAction` vuelve a consultar `get_invitation`, y si está pendiente y `has_account = false` crea el usuario con `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` usando un cliente con `SUPABASE_SECRET_KEY` (`lib/supabase/admin.ts`, con `import "server-only"`). Después inicia sesión con el cliente de servidor normal (`signInWithPassword`, que deja las cookies) y llama a `accept_invitation`. Para "Invitado con cuenta" no se usa la service role: `signInWithPassword` + `accept_invitation`.
- Por qué confirmado: con el SMTP actual el correo de confirmación no llegaría, y la persona ya demostró tener el link que el admin le mandó a ella.
- Alternativa descartada: `signUp` normal desde la página (requiere confirmar el correo). Alternativa descartada: una función SQL que marque `email_confirmed_at` en `auth.users` (escribir en el esquema `auth` desde SQL propio es frágil).
- Si falla `accept_invitation` después de crear la cuenta, la cuenta queda creada y la pantalla muestra el error; reintentar con el mismo link entra por el camino "con cuenta".

### 8. Club activo en una cookie, resuelto en el servidor
Cookie `club_activo` (id del club, `sameSite=lax`, un año; no es secreta porque el RLS sigue protegiendo). `getSessionContext` lee las membresías del usuario con el club (`memberships` + `clubs`), usa la que coincide con la cookie y, si no hay coincidencia, la más reciente. Devuelve también la lista de clubes para el selector. `switchClubAction(clubId)` valida que la persona sea miembro, escribe la cookie y hace `revalidatePath("/dashboard", "layout")`.
- `useMembership` deja de consultar por su cuenta: `app/dashboard/layout.tsx` (Server Component) resuelve el contexto una vez y lo pasa como props planas a `DashboardShell`, que lo expone con un contexto de React (`ActiveClubProvider`). Los hooks del cliente toman `club_id` de ahí.
- Alternativa: guardar el club activo en `user_metadata`. Obliga a una escritura en Auth por cada cambio y no distingue dispositivos.

### 9. Filtro explícito por `club_id` en todas las consultas
Cada `.from(...)` del cliente y de las Server Actions agrega `.eq("club_id", clubId)` (o lo usa en el `insert`). El RLS sigue siendo la barrera de seguridad; el filtro es el que garantiza "solo el club activo" para quien pertenece a varios. Las Server Actions toman `clubId` del contexto del servidor, nunca de un parámetro del cliente.

### 10. Rutas y guardas
- `app/dashboard/layout.tsx`: sin sesión → `/login`; sin membresías → `/bienvenida`.
- `/bienvenida` (requiere sesión): elección "Crear mi club" / "Me van a invitar". Con membresías, igual se puede abrir desde "Crear otro club".
- `/bienvenida/club`: formulario del artboard `AltaClub` (RHF + Zod), con la vista previa de canchas. Al terminar → `/dashboard/canchas?alta=1`, que muestra un aviso "Paso 3 de 3: definí precio, duración y seña".
- `/invitacion/[token]`: pública. Server Component que llama a `get_invitation` y elige el estado (válida con/sin cuenta, sesión con otra cuenta, sesión con el mismo correo, vencida, usada, cancelada, inválida); el formulario es un Client Component con RHF + Zod y el toggle de contraseña.
- Registro y verificación: después de verificar el correo se va a `/dashboard`, que redirige a `/bienvenida`. `proxy.ts` no cambia (solo refresca la sesión).

### 11. Compartir por WhatsApp
`https://wa.me/?text=<mensaje codificado>` sin número (WhatsApp deja elegir el contacto). Mensaje: "Hola {nombre}, te invito a sumarte a {club} en saque como {rol}. Entrá con tu correo {email} desde este link: {link} (vence el {fecha})". En celular abre la app; en escritorio, WhatsApp Web.

## Risks / Trade-offs

- [El renombre de columnas rompe cualquier consulta que quede sin actualizar] → Una sola migración + reemplazo de todas las referencias en la misma fase; `pnpm exec tsc --noEmit`, `pnpm build` y `grep -rn "owner_id\|user_id"` sin resultados en tablas del club antes de seguir.
- [La clave secreta (`sb_secret_…`, equivalente a la service role) bypassa todo el RLS] → Solo en `lib/supabase/admin.ts` con `server-only`, solo para `auth.admin.createUser`, nunca con prefijo `NEXT_PUBLIC_`. Se documenta en el README.
- [Un link reenviado permite crear la cuenta del correo invitado sin verificar ese correo] → El link es de un solo uso, vence en 7 días, el admin ve en Equipo quién aceptó y puede sacarlo; si la persona real después quiere entrar, recupera la contraseña con su correo.
- [`has_account` en `get_invitation` revela si un correo tiene cuenta] → Solo se responde con un token válido, que es un secreto de 32 bytes emitido por el admin.
- [Una persona con sesión abierta en dos pestañas cambia de club en una] → La otra sigue mostrando el club anterior hasta recargar; las Server Actions usan el club de la cookie actual, así que una acción desde la pestaña vieja actuaría sobre el club nuevo. Se acepta: es el mismo comportamiento que otras apps multi-organización; el cambio de club se hace con recarga completa.
- [Errores en la migración sobre datos reales] → Probar primero en una rama o copia de Supabase; la migración corre en transacción y se verifica con conteos antes/después.

## Migration Plan

1. Agregar `SUPABASE_SECRET_KEY` a `.env.local` (y al entorno de despliegue).
2. Anotar conteos por tabla (canchas, reservas, cobros, saldos, auditoría, membresías) del club actual.
3. Aplicar `0007_clubs_and_invitations.sql` con `supabase db push`.
4. Verificar conteos iguales, el nombre "Club Deportivo Central" y que los operadores quedaron con una sola membresía.
5. Desplegar el código nuevo inmediatamente después: el código viejo no funciona con las columnas renombradas.
6. Rollback: no hay migración inversa automática. Se prepara un script `0007_down.sql` (renombrar de vuelta a `owner_id`/`user_id`, recrear funciones, policies y trigger, borrar `clubs` y `club_invitations`) que se prueba en la copia antes de aplicar en producción.
