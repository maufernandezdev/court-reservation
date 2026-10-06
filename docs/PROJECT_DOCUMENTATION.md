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

### Roles, membresías y tenancy por club (migración `0004_memberships_and_rls.sql`, 2026-10)

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

- **Diseño de referencia:** canvas https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF (13 pantallas). Nombre de producto de trabajo: **saque**, centralizado en `lib/brand.ts` (cambiarlo ahí renombra login, menú y título del navegador). El nombre del club sigue saliendo de `CLUB_NAME` (`lib/mocks/data.ts`) hasta que exista una entidad club.
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
- **Pendientes del diseño (2026-10-06, registrados como cambios OpenSpec sin implementar):** `add-club-onboarding` (alta del club en 3 pasos + selector multi-club), `add-fixed-reservations` (turnos fijos/clases + alerta de liberaciones), `add-court-surface` (superficie de cancha), `add-cancellation-options` ("cancela el club" sin penalidad + devolución de seña en vez de saldo a favor), `add-public-booking-portal` (portal público + Mercado Pago). Modo oscuro: sin cambio registrado.
- Usuarios unconfirmed huérfanos (emails con typo): no se limpian automáticamente. Se puede borrar a mano desde Authentication → Users en el dashboard, o armar una Edge Function con `service_role` que los purgue.

## Semántica de reservas y ocupación

- **`reservations.time`:** franja de **inicio** `"HH:MM"`. Desde la migración `0006` la duración es variable (`duration_minutes`, según `slot_duration` de la cancha: 30/60/90). La grilla desktop usa bloques de 30 min como mínimo común; la grilla real por cancha sale de `getCourtSlots()` (`lib/availability.ts`) según sus horarios. El `TIME_SLOTS` mock de `lib/mocks/data.ts` quedó obsoleto para reservas (lo siguen usando algunas páginas mock).
- **"Ahora en cancha" (Hoy, `/dashboard`):** desde 2026-10-06 usa la duración real de cada turno (`courtStatusNow` en `lib/daily-overview.ts`): una cancha está ocupada si hay un turno activo con `inicio ≤ ahora < inicio + duración`; si no, figura "Libre hasta" el próximo turno o el cierre, y "Cerrada" fuera de su horario. Hoy también calcula cobrado/por cobrar con los `payments` no liberados de los turnos del día.
- **Fechas:** se manejan como strings `YYYY-MM-DD` (hora local del navegador), no timestamps. Aceptable para un club en un único país; si se opera en varias zonas horarias habría que revisarlo.
- **RLS:** el aislamiento es por club: `is_member(user_id)` permite ver/tocar solo filas de clubes donde el usuario es miembro. El trigger `reservations_check_court_owner` sigue rechazando insert/update que apunte a una cancha que no pertenezca al mismo owner. Las reglas de negocio por rol (configuración, cancelaciones) se validan en Server Actions.

## Herramientas

- **Playwright CLI global (2026-10-05):** v1.63.0 en `~/.nvm/versions/node/v24.20.0/bin/playwright`. Es la herramienta preferida para verificar la UI del proyecto (screenshots, navegación, tests E2E). Uso típico desde la shell: `playwright screenshot <url> <archivo.png>`, `playwright open <url>`, `playwright test`.
- **No hay MCP de Playwright configurado** en este proyecto (los únicos MCP configurados son Figma). La carpeta `.playwright-mcp/` del repo son artefactos que dejó el skill `playwright-cli` al usarse el 2026-10-02 (snapshots de página `.yml` y logs de consola); está en `.gitignore` y se puede borrar sin problema.
- Para levantar la app y recorrerla (verificación manual de flujos), usar el skill `run` de Claude Code o `pnpm dev` + Playwright CLI.
- **Club de prueba (2026-10-06):** en el proyecto Supabase real hay un club de prueba con admin `saque.admin.prueba@example.com` y operador `saque.operador.prueba@example.com` (contraseñas en `.env.local` como `TEST_*`), 6 canchas y turnos sembrados para el 6 y 7 de octubre. Scripts en `scripts/dev/`: `shots.cjs` (login + capturas por ruta, `FAKE_NOW` para simular la hora), `inspect-test-reservations.mjs` (ve/limpia los turnos "Prueba*" que dejan las pruebas; necesita la service key por variable de entorno, nunca en archivos) y `seed-test-club.mjs` (referencia de cómo se sembró). Ojo: muchos logins seguidos disparan el rate limit de Supabase Auth (429) y cortan la sesión.
