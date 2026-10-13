# Project Documentation

Lugar de notas del proyecto: decisiones, pendientes y configuraciones que no se desprenden del código.

## Decisiones

### Verificación de email en el registro: por link, no por código

- El registro (`app/register/page.tsx`) muestra una pantalla de "Revisá tu email" después del signup, indicando que se envió un correo con un **link de confirmación** (no un código).
- El link redirige a **`/verification-account`**, que toma el parámetro `?code=` de la URL, lo canjea con `supabase.auth.exchangeCodeForSession(code)` (esto es lo que valida el email), y muestra un resultado: éxito (con cuenta regresiva de 10 s y botón para ir al inicio) o error (link inválido/expirado).
- **Decisión (2026-09):** se descartó la verificación por código OTP. Supabase por defecto manda un link (`{{ .ConfirmationURL }}`), y hacer que mande un código requería editar el template "Confirm signup" para incluir `{{ .Token }}`. Como el envío de emails igual queda pendiente de configurar un **SMTP propio** (el SMTP por defecto de Supabase tiene límites muy bajos y no sirve para producción), se optó por el flujo de link que funciona con el template por defecto.
- La pantalla tiene "Reenviar correo" (`supabase.auth.resend({ type: "signup" })`) y "Cambiar email" (vuelve al formulario y registra un usuario nuevo; el anterior queda unconfirmed huérfano).
- Si la confirmación de email está deshabilitada en el proyecto, `signUp` devuelve sesión y el usuario entra directo al dashboard (ya manejado en el código).
- Cuando se configure el SMTP propio: Authentication → Emails → conectar SMTP, y probar el flujo completo.

- **(2026-10-12) Error falso "PKCE code verifier not found" al verificar:** Supabase valida el correo al abrir el link (`/auth/v1/verify`) y recién después redirige a `/verification-account?code=…`. El cliente del navegador de `@supabase/ssr` canjea ese `code` solo al iniciarse (`detectSessionInUrl`, activo por defecto) y borra el verificador; la página volvía a llamar a `exchangeCodeForSession` y ese segundo canje fallaba, aunque la cuenta ya estaba validada y la sesión iniciada. Ahora la página solo espera el canje automático (`getSession`). Si el link se abre en otro navegador o dispositivo (sin el verificador guardado al registrarse), no hay sesión pero el correo igual quedó validado: muestra "¡Cuenta verificada!" y manda a ingresar. Probado en Supabase local con confirmación activada y Mailpit (reproduce el error con el código anterior).

### Límite de emails del SMTP por defecto

- El SMTP por defecto de Supabase permite solo **2 emails por hora por proyecto**, compartidos entre todos los endpoints (signup, reenvío, magic link, recuperación de contraseña). Además hay un cooldown de 60 s entre reenvíos al mismo email.
- **No se puede subir** ese límite; el servicio por defecto es solo para pruebas.
- Workarounds para desarrollo: esperar la hora, desactivar "Confirm email" en Authentication → Sign In / Providers → Email, usar Supabase CLI local (Inbucket captura los mails sin límite), o configurar SMTP propio (con SMTP custom el límite pasa a 30/hora y es configurable en Authentication → Rate Limits).

### Configuración de auth del proyecto (relevada 2026-10-06 con `supabase config pull --dry-run` en una carpeta temporal)

- **Confirmación de email: activada** (`auth.email.enable_confirmations = true`; `/auth/v1/settings` devuelve `mailer_autoconfirm: false`). El registro siempre pasa por "Revisá tu email".
- **SMTP: el de Supabase por defecto** (no hay `[auth.email.smtp]` configurado). Además del límite de envíos por hora, en los proyectos actuales el SMTP por defecto **solo entrega a direcciones que sean miembros del equipo de la organización** en Supabase: un registro con otro email no recibe el link. Sirve para probar con tu propio mail, no con usuarios reales.
- **Site URL:** `http://localhost:3000`. **Redirect URLs adicionales:** ninguna. El registro pide redirigir a `<origen>/verification-account`; en localhost funciona porque coincide con el host de la Site URL. Si Supabase rechaza la redirección, cae en la Site URL (`/`): desde 2026-10-06 la raíz reenvía `?code=` a `/verification-account`, y si no hay código va a `/dashboard`.
- Reenvío: `max_frequency = 1m` entre emails al mismo destinatario.
- **Para pasar a usuarios reales:**
  1. Configurar un SMTP propio (Resend, Brevo, SendGrid, Amazon SES, etc.) en Authentication → Emails → SMTP Settings, con un dominio verificado (SPF/DKIM).
  2. Ajustar el límite en Authentication → Rate Limits (con SMTP propio arranca en 30/h y es configurable).
  3. Al desplegar: poner la URL de producción como Site URL y agregar `https://<dominio>/**` (y `http://localhost:3000/**` para desarrollo) en Redirect URLs.
  4. Opcional: personalizar el template "Confirm signup" (en español, con la marca).

## Decisiones y semántica

### Mi perfil y fotos en Cloudflare R2 (migración `0011`, cambio `add-profile-editing`, 2026-10-12)

- **`profiles`** (uno por usuario: nombre, ruta de la foto y su versión). Sin escritura directa: todo pasa por funciones `SECURITY DEFINER`. `update_my_name` guarda el nombre en `profiles` y en **todas** las `memberships.full_name` de la persona (así menú, Equipo, Actividad y Caja no cambiaron sus consultas). `set_my_avatar` solo acepta la ruta propia. `set_my_profe_color` deja al profe elegir su color (el admin sigue pudiendo desde Equipo). Se lee el propio perfil y el de quienes comparten club (`shares_club_with`).
- **Correo:** `updateUser({ email })` con regreso a `/dashboard/perfil?correo=confirmado`; con el "cambio de correo seguro" llegan dos links (al correo nuevo y al actual) y hasta confirmarlos sigue vigente el anterior. El trigger `on_auth_user_email_changed` copia el correo confirmado a `memberships.email`. Depende del SMTP de Supabase (con el de prueba solo llega a correos del equipo).
- **Contraseña:** se verifica la actual con `signInWithPassword` en el servidor antes de `updateUser({ password })`.
- **Fotos:** bucket privado `court-reservation` (sin acceso público ni CORS). El navegador recorta al centro y reduce a 512×512 WebP; `uploadAvatarAction` sube `avatars/<userId>.webp` con `aws4fetch` (`lib/r2.ts`, `server-only`). Se sirven por la ruta BFF `/api/avatars/[userId]` (sesión + RLS de `profiles`, caché privada de un día, `?v=` con la versión); `next/image` va con `unoptimized` porque el optimizador no manda las cookies. Credenciales en `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET_NAME` (también se acepta `R2_BUCKET`); `R2_ALLOWED_ORIGINS` no se usa. Para revisar el bucket: `wrangler r2 bucket info court-reservation` / `wrangler r2 object get court-reservation/<clave> --remote --pipe`.

### Socios, tipos de turno, fijos y precios por deporte (migraciones `0008` y `0009`, cambio `add-reservation-types-and-socios`, 2026-10-12)

- **Valor fijado en el turno:** `reservations.price` se calcula en el servidor al crear (precio por hora del tipo de cancha × duración; precio profe en turnos de profe) y solo se recalcula si cambian cancha, tipo o duración. Cobros, saldo, seña, cancelación, Hoy y Caja usan ese valor. El backfill de `0008` dejó a cada turno con el valor que tenía.
- **Precios por deporte** (`sport_prices`): público, profe y seña (fija o %), uno por tipo de cancha del club; se crea la fila al dar de alta la primera cancha de un deporte. Las columnas de precio y seña de `courts` quedan sin uso (se pueden borrar en un cambio posterior).
- **Tipos** (`reservations.kind`: `standard` / `profe` / `torneo`, con `profe_user_id`): un profesor solo carga turnos de profe a su nombre. En turnos de profe, la persona 1 es el profe y las demás son alumnos. Torneo: mínimo 2 personas, duración en pasos de 30 min hasta el cierre (default `settings.tournament_duration_minutes`).
- **Personas** (`reservation_participants`, 1 a 4): la 1 se copia en `customer_name` (saldo a favor, búsqueda y Actividad siguen igual). Se guardan después del turno; si fallan, el alta se compensa borrando el turno.
- **Socios** (`socios`): baja lógica (`deleted_at`), DNI normalizado sin puntos y único entre activos; los ve todo el club (el profe los busca), los gestionan admin y operador.
- **Fijos** (`reservation_series`): cada fecha se **materializa** como un turno común con `series_id` (`unique (series_id, date)`). `ensure_series_until(club, fecha)` genera lo que falta hasta la fecha consultada (lo llaman la planilla, Hoy y el buscador, de hoy a un año) y saltea fechas ocupadas. Liberar una fecha = cancelar ese turno (no se vuelve a generar). Baja desde una fecha: `ends_on`, se liberan las fechas sin cobros y quedan activas las que tienen cobros. No se puede editar una serie: se da de baja y se crea otra.
- **Color de profe** (`memberships.color`): paleta fija (`lib/profe-colors.ts`); el trigger `assign_profe_color` (`0009`) asigna el primer color libre al sumarse o pasar a profesor; el admin lo cambia en Equipo.
- **Visual** (`reservationLook`, `reservationTitle`, `ReservationMarks` en `lib/reservation-tone.ts` y `components/reservations/`): estándar = relleno por estado de pago; profe = color del profe; torneo = azul de marca con trofeo y "A vs B"; fijo = ícono de repetición. En profe y torneo el estado de pago va como texto.

### Clubes, invitaciones y club activo (migración `0007_clubs_and_invitations.sql`, cambio `add-club-onboarding`, 2026-10-12)

Reemplaza el modelo "el club es el id del dueño" de `0004` (ver sección siguiente, que queda como historia).

- **Tabla `clubs`** (`name`, `city`, `created_by`). Todas las tablas del club tienen `club_id` con FK a `clubs` (antes `owner_id` en `memberships`/`payments`/`settings`/`credit_balances`/`audit_log` y `user_id` en `courts`/`reservations`). Los clubes que existían conservaron su id (= id del dueño), así que ningún dato cambió de valor; se llaman "Club Deportivo Central" hasta que el admin lo cambie en Políticas.
- **Clubes vacíos:** la migración borró las membresías admin propias sin datos ni otros miembros que había creado `handle_new_user` (el operador de prueba, cuentas sin uso). Esas personas, si no pertenecen a otro club, pasan por `/bienvenida`.
- **Registro sin club:** se eliminaron `handle_new_user` (trigger) y `find_user_id_by_email`. Las membresías solo nacen de `create_club` (RPC atómica: club + admin + `settings` + canchas numeradas + auditoría) o de aceptar una invitación. No hay policy de insert directo en `memberships`.
- **Invitaciones** (`club_invitations`): el token del link son 32 bytes aleatorios en base64url (`lib/invitations-server.ts`); en la base queda solo `sha256(token)`, por eso el link se ve únicamente al crearlo o regenerarlo. Vence a los 7 días, es de un solo uso (`accept_invitation` bloquea la fila) y hay una sola invitación abierta por club y correo (índice único parcial). `get_invitation` (pública, `anon`) devuelve estado, club, rol, correo y si el correo ya tiene cuenta, sin datos del club si el token no existe. `accept_invitation` / `accept_invitation_by_id` exigen que el correo de la sesión (`auth.jwt() ->> 'email'`) sea el invitado.
- **Cuenta del invitado:** si no tiene cuenta, `joinWithInvitationAction` la crea con `auth.admin.createUser({ email_confirm: true })` usando `SUPABASE_SECRET_KEY` (solo en `lib/supabase/admin.ts`, con `server-only`), inicia sesión y acepta. Se eligió confirmada porque el SMTP actual no entregaría el correo de confirmación y el link ya prueba que el admin se lo mandó a esa persona. Riesgo aceptado: un link reenviado permite crear la cuenta de ese correo; el link es de un uso, vence y el admin ve quién se sumó.
- **Club activo:** cookie `club_activo`; si no hay o ya no es miembro, la membresía más reciente. Se resuelve en el servidor (`getSessionContext`, `app/dashboard/layout.tsx`) y llega al cliente por `ActiveClubProvider` (`useMembership` lo lee). Además del RLS, **todas las consultas filtran por `club_id`** del club activo: con una persona en dos clubes, el RLS solo no alcanza para no mezclar datos. Cambiar de club (`switchClubAction`) recarga el panel completo.
- **Vuelta atrás:** `supabase/rollback/0007_down.sql` (fuera de `migrations/`); aborta si ya hay clubes creados después de 0007.
- **Pruebas:** la migración y todos los flujos se probaron en Supabase local (Docker) con datos que imitan producción, antes de aplicarla en el proyecto real.

### Roles, membresías y tenancy por club (migración `0004_memberships_and_rls.sql`, 2026-10) — reemplazado por 0007

- El modelo pasó de "usuario aislado" a **club multiusuario**: `user_id` en `courts`/`reservations` es el **dueño del club** (owner/tenant). Los miembros entran por `memberships (owner_id, user_id, role, full_name, email)` con rol `admin` | `operador` | `profesor`.
- RLS: policies por `is_member(owner_id)` / `is_staff(owner_id)` (funciones `SECURITY DEFINER` en `0004` para evitar recursión de RLS). El enforcement fino de roles (quién configura, quién cancela dentro de ventana) vive en **Server Actions** (`requireRole` en `lib/auth.ts`) Y en triggers de BD (`protect_reservation_money` en `0006`: `payment_status` solo lo cambia staff; un profesor no puede cancelar dentro de la ventana de penalidad, la valida la propia base leyendo `settings`).
- Backfill + onboarding: `handle_new_user` (trigger en `auth.users`, en `0004`) crea la membresía propia admin de cada usuario nuevo; el backfill cubre a todos los usuarios existentes. Sin esto, un usuario registrado después de la migración quedaba sin club (dead-end).
- **Invitar miembros**: el admin agrega por email (`find_user_id_by_email`, SECURITY DEFINER con `execute` revocado a `anon`/`public` para evitar enumeración de usuarios). La persona **debe tener cuenta registrada** antes; si no, se le pide que se registre primero.
- `courts_insert_admin`/`courts_update_admin`: solo el admin del club crea/edita canchas (precios, horarios, señas). Operadores y profesores no ven "Canchas", "Miembros" ni "Configuración" en la sidebar.

### Configuración de negocio de canchas (migración `0005_courts_business_config.sql`, 2026-10)

- `courts` gana: `price_per_hour`, `slot_duration` (30/60/90), `open_time`/`close_time`, y seña: `deposit_enabled`, `deposit_type` (`fixed`|`percent`), `deposit_value`.
- Defaults no destructivos para canchas existentes: precio 0, turnos de 60 min, 09:00–22:00, seña deshabilitada. **Hay que configurar precio/seña para poder cobrar.**
- PostgREST serializa columnas `time` como `"HH:MM:SS"`; la app normaliza a `"HH:MM"` con `normalizeTime()` en los puntos de fetch (`use-courts`, página de canchas). `reservations.time` es `text` y ya viene en `"HH:MM"`.

### Ciclo de vida de reservas, pagos, políticas y auditoría (migración `0006_reservations_lifecycle.sql`, 2026-10)

- Las reservas **ya no se borran**: cancelación lógica con `status`, `cancelled_at`, `cancelled_by`, `cancel_reason`, `late_cancel`. El turno se libera con índice único parcial `UNIQUE(court_id, date, time) WHERE status = 'active'` (reemplaza al constraint total de `0002`).
- `reservations.duration_minutes`: duración variable por cancha. El chequeo de solapamiento es por rangos en `lib/availability.ts` (app) + índice parcial (DB); no hay exclusion constraint.
- Políticas de cancelación en `settings` por club: `cancel_window_hours` (default 24) y `late_penalty_percent` (default 50). La cancelación considera **todo lo cobrado** (seña, total o saldo aplicado): tardía → penalidad = % del valor del turno, retenida de lo cobrado (si alcanza; si sobra, se libera) o registrada como deuda en `credit_balances` (negativo = deuda, por teléfono del cliente); en término → todo lo cobrado se libera como **saldo a favor** (aplicable como cobro en reservas futuras). Los movimientos de saldo usan la RPC atómica `adjust_credit_balance` (evita lost updates).
- **Timezone:** el club se asume en Argentina (UTC-3 fijo); las acciones de servidor calculan el inicio del turno con offset `-03:00` explícito. El trigger `protect_reservation_money` compara contra `now()` del servidor (UTC en Supabase): es un backstop anti-bypass, con tolerancia de ±3 hs respecto de la app solo relevante para abuso vía cliente directo.
- Restricción del **profesor**: no puede cancelar dentro de la ventana de penalidad ni reservas con cobros registrados (la plata la gestiona staff). Regla aplicada en Server Action y en el trigger `protect_reservation_money` de la BD (que lee la ventana de `settings`).
- Pagos manuales en tabla `payments` (`kind` seña/total/saldo, `method`, `external_ref` **reservado para Mercado Pago** — la integración queda para una iteración posterior, el modelo ya está listo). `payment_status` de la reserva se deriva de los cobros; las policies de escritura de `payments`/`credit_balances`/`audit_log` exigen `is_staff` (admin/operador).
- Auditoría: `created_by`/`updated_by` en reservas + tabla append-only `audit_log` (actor, entidad, acción, payload). El detalle de reserva muestra el historial a admins.
- **Riesgo aceptado (carrera de doble reserva):** el índice parcial solo bloquea inicios idénticos de turno; dos inserts concurrentes de franjas distintas que se solapen (p. ej. 09:00 y 09:30 en cancha de 60 min) podrían colarse pese al chequeo de solapamiento en la acción. Volumen de un club chico lo hace improbable; si aparece, migrar a exclusion constraint con `btree_gist`.

### Planilla mobile-first

- Desktop: grilla canchas × franjas de 30 min (mínimo común) entre menor apertura y mayor cierre; los turnos de 60/90 min ocupan celdas contiguas.
- Mobile (`< lg`): tabs por cancha + lista vertical de sus franjas (según `open_time`/`close_time`/`slot_duration` de cada cancha), sin scroll horizontal. Crear/editar/cobrar/cancelar funciona igual en ambas vistas (mismo `ReservationDialog`).
- Buscador de disponibilidad: dialog con fecha, franja opcional y tipo; lista franjas libres (`findFreeSlots`) y crea la reserva directo.

### Identidad visual "saque" (cambio `apply-saque-visual-design`, 2026-10-06)

- **Diseño de referencia:** canvas https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF (13 pantallas). Nombre de producto de trabajo: **saque**, centralizado en `lib/brand.ts` (cambiarlo ahí renombra login, menú y título del navegador). Desde `0007` el nombre del club sale de `clubs.name` (antes, de la constante `CLUB_NAME`).
- **Tokens** en `app/globals.css` (HSL, formato shadcn): piso `#F6F7F3`, tinta `#101418`, pelota `#D7F04A` (`bg-ball`), línea `#2C55D1` (`--ring`, `bg-line`), error `#C2361F`, a favor `#1F7A4D`. `--accent` es el **gris de hover** de shadcn, no el amarillo: el amarillo de marca es `ball`. Los estilos globales (`*`, `body`) van dentro de `@layer base`; fuera de la capa pisan todas las utilidades de color de borde. Sin modo oscuro.
- **Tipografías** (`next/font/google` en `app/layout.tsx`): Archivo con eje `wdth` (`font-display font-stretch-[125%]`, títulos y números), Geist (interfaz), Geist Mono (horarios, montos, registros).
- **Estados de turno:** una sola fuente en `lib/reservation-tone.ts` (`toneFor`, `toneClasses`) + variantes `paid/deposit/pending/cancelled/fixed` del `Badge`. Se distinguen por luminosidad: pagada = tinta, señada = pelota, pendiente = punteado, cancelada = rayado (`bg-hatch`).
- **Navegación** (`components/shell/nav-config.ts`): rótulos nuevos sobre rutas viejas — Hoy = `/dashboard`, Planilla = `/dashboard/reservas`, Equipo = `/dashboard/miembros`, Políticas = `/dashboard/configuracion`; página nueva Actividad = `/dashboard/actividad` (solo admin). En celular: barra inferior (`mobile-tab-bar.tsx`); "Buscar" abre el buscador con `/dashboard/reservas?buscar=1`.
- **Detalle de un turno:** la lógica (cobros, saldo a favor, cancelación, historial) vive en `hooks/use-reservation-detail.ts`; la UI en `reservation-detail-panel.tsx`, que se muestra como panel lateral (escritorio), hoja inferior (celular) o dentro del diálogo (Hoy). El cálculo de retención/saldo/deuda de una cancelación está en `lib/cancellation.ts` y **replica** `cancelReservationAction`: si cambia uno, cambiar el otro.
- **Cobro total = saldo:** desde 2026-10-06 "Cobrar total" registra solo lo que falta (precio − cobrado no liberado). Antes cobraba el precio completo aunque hubiera seña.
- **Actividad:** Server Component que lee `audit_log` con filtros en la URL (`persona`, `tipo`, cursor `antes`), validados con Zod. Las frases salen de `describeAuditEntry` (`lib/audit.ts`), que también usa el historial del detalle del turno.

### Aplicación de migraciones (2026-10-05: con Supabase CLI)

- Las 6 migraciones están **aplicadas a producción y con el historial sincronizado**. El flujo a partir de ahora: crear el archivo en `supabase/migrations/` y correr `supabase db push` (requiere `SUPABASE_DB_PASSWORD`, que vive en `.env.local`, y sesión del CLI vía Personal Access Token).
- `0001`–`0003` se habían aplicado a mano en el SQL Editor; se marcaron como aplicadas con `supabase migration repair` (2026-10-05) sin re-ejecutarlas, previa verificación de que el schema remoto coincidía con los archivos de migración.
- El seed de "en término vs. tardía" y los defaults de `settings`/`courts` viven en el código cuando no hay fila: no hace falta insertar settings al aplicar la migración.

### Soft delete de canchas (migración `0003_court_soft_delete.sql`, aplicada 2026-09-24): la baja de una cancha es lógica: se marca `active = false` y la fila (con sus reservas) queda en la base. Todas las queries del cliente filtran `.eq("active", true)`, así que la cancha desaparece de la UI. La migración también agregó la policy RLS `courts_update_own` (update sobre filas propias), que usan tanto la edición como la baja lógica. No hay policy de DELETE a propósito: la baja física no es un flujo soportado.
- `/dashboard/canchas` es Server Component: lee con el client de servidor y muta vía Server Actions (`app/dashboard/canchas/actions.ts`), que validan con Zod, chequean sesión y hacen `revalidatePath`. Las páginas de reservas y home siguen en el cliente con `useCourts()`/`useReservations()`.

## Pendientes

- **(2026-10-01, resuelto 2026-10-05) Aplicar migraciones 0004-0006 a Supabase.** Aplicadas con Supabase CLI (`link` → `migration repair` de 0001–0003 → `db push`). Queda pendiente la verificación manual (tarea 11.2 de `openspec/changes/add-club-operations-foundation/tasks.md`): dos usuarios, invitación de operador, cobro de seña, cancelación tardía, auditoría. Luego marcar las tareas 1.3, 2.2, 3.3 y 11.2 en `tasks.md`.
- **Iteraciones siguientes (post-migración):** portal público de reservas con Mercado Pago (sandbox primero; el modelo ya tiene `payments.external_ref` listo), turnos fijos/recurrentes para profes (SRS 2.2, fuera de alcance de esta iteración), caja/reportes reales (hoy siguen mock).
- **Pendientes del diseño (2026-10-06, registrados como cambios OpenSpec sin implementar):** `add-fixed-reservations` (absorbido por `add-reservation-types-and-socios` el 2026-10-12; queda pendiente solo la alerta de liberaciones y el abono mensual), `add-court-surface` (superficie de cancha; postergado 2026-10-12 hasta que el producto se instale en otros clubes), `add-cancellation-options` ("cancela el club" sin penalidad + devolución de seña en vez de saldo a favor), `add-public-booking-portal` (portal público + Mercado Pago). Modo oscuro: sin cambio registrado.
- **(2026-10-12) `add-club-onboarding`: `0007` aplicada en producción.** Falta agregar `SUPABASE_SECRET_KEY` a `.env.local` y al entorno de despliegue (sin ella, aceptar una invitación sin cuenta falla) y desplegar el código (el viejo no funciona con `0007`). El envío de la invitación por correo desde la app queda para cuando haya SMTP propio o un proveedor como Resend.
- **(2026-10-12) Pruebas manuales pendientes:** la lista está en `docs/next-steps.md` ("Pruebas pendientes"); las hace el usuario en `localhost:3000` contra la base real.
- **(2026-10-12) Migraciones en producción:** aplicadas hasta `0011` (`0010` todavía no existe: es la de `add-night-pricing`, sin implementar). Falta desplegar el código y cargar las variables (`SUPABASE_SECRET_KEY` y las de R2) en el entorno de despliegue.
- Usuarios unconfirmed huérfanos (emails con typo): no se limpian automáticamente. Se puede borrar a mano desde Authentication → Users en el dashboard, o armar una Edge Function con `service_role` que los purgue.

## Semántica de reservas y ocupación

- **`reservations.time`:** franja de **inicio** `"HH:MM"`. Desde la migración `0006` la duración es variable (`duration_minutes`, según `slot_duration` de la cancha: 30/60/90). La grilla desktop usa bloques de 30 min como mínimo común; la grilla real por cancha sale de `getCourtSlots()` (`lib/availability.ts`) según sus horarios. El `TIME_SLOTS` mock de `lib/mocks/data.ts` quedó obsoleto para reservas (lo siguen usando algunas páginas mock).
- **"Ahora en cancha" (Hoy, `/dashboard`):** desde 2026-10-06 usa la duración real de cada turno (`courtStatusNow` en `lib/daily-overview.ts`): una cancha está ocupada si hay un turno activo con `inicio ≤ ahora < inicio + duración`; si no, figura "Libre hasta" el próximo turno o el cierre, y "Cerrada" fuera de su horario. Hoy también calcula cobrado/por cobrar con los `payments` no liberados de los turnos del día.
- **Fechas:** se manejan como strings `YYYY-MM-DD` (hora local del navegador), no timestamps. Aceptable para un club en un único país; si se opera en varias zonas horarias habría que revisarlo.
- **RLS:** el aislamiento es por club: `is_member(club_id)` permite ver/tocar solo filas de clubes donde el usuario es miembro, y la app además filtra por el club activo. El trigger `reservations_check_court_owner` rechaza insert/update que apunte a una cancha de otro club. Las reglas de negocio por rol (configuración, cancelaciones) se validan en Server Actions.

## Herramientas

- **Playwright CLI global (2026-10-05):** v1.63.0 en `~/.nvm/versions/node/v24.20.0/bin/playwright`. Es la herramienta preferida para verificar la UI del proyecto (screenshots, navegación, tests E2E). Uso típico desde la shell: `playwright screenshot <url> <archivo.png>`, `playwright open <url>`, `playwright test`.
- **No hay MCP de Playwright configurado** en este proyecto (los únicos MCP configurados son Figma). La carpeta `.playwright-mcp/` del repo son artefactos que dejó el skill `playwright-cli` al usarse el 2026-10-02 (snapshots de página `.yml` y logs de consola); está en `.gitignore` y se puede borrar sin problema.
- Para levantar la app y recorrerla (verificación manual de flujos), usar el skill `run` de Claude Code o `pnpm dev` + Playwright CLI.
- **Club de prueba (2026-10-06):** en el proyecto Supabase real hay un club de prueba con admin `saque.admin.prueba@example.com` y operador `saque.operador.prueba@example.com` (contraseñas en `.env.local` como `TEST_*`), 6 canchas y turnos sembrados para el 6 y 7 de octubre. Scripts en `scripts/dev/`: `shots.cjs` (login + capturas por ruta, `FAKE_NOW` para simular la hora), `inspect-test-reservations.mjs` (ve/limpia los turnos "Prueba*" que dejan las pruebas; usa `SUPABASE_SECRET_KEY` de `.env.local`) y `seed-test-club.mjs` (referencia de cómo se sembró). Ojo: muchos logins seguidos disparan el rate limit de Supabase Auth (429) y cortan la sesión.
