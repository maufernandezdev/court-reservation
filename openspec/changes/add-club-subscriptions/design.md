## Context

Cada club es un cliente del SaaS (`clubs`), y adentro hay usuarios con rol (`memberships`: admin, operador, profesor) y jugadores sin cuenta. Hoy no existe nada que registre si el club paga: la pantalla `/dashboard/suscripcion` lee `SUBSCRIPTION_PLANS` de `lib/mocks/data.ts`. Los planes de esa pantalla (Inicial hasta 3 canchas $15.000, Club hasta 6 $25.000, Gran Club 7 o más $35.000, anual con 10 % de descuento) son los que se confirmaron para este cambio.

Ya existen `is_member`, `is_admin` y `is_staff` (SECURITY DEFINER) para las políticas, `create_club` (RPC que crea club, membresía admin, políticas y canchas, redefinida en 0008) y las canchas con baja lógica (`courts.active`). El service role (`SUPABASE_SECRET_KEY`) saltea RLS y llega con `auth.uid()` nulo. Las migraciones 0010 (precio de noche) y 0012 (jugadores) están reservadas; esta es la 0013.

Motivación y alcance: ver proposal.md y los specs.

## Goals / Non-Goals

**Goals:**
- Saber en cualquier momento, con una sola consulta, si un club está en prueba, al día, en gracia o vencido.
- Que el modelo de pagos ya tenga los campos que va a necesitar Mercado Pago, de modo que integrarlo después no cambie tablas.
- Que las reglas (límite de canchas, solo lectura) las haga cumplir la base, no solo la pantalla.

**Non-Goals:**
- SDK, checkout, webhook ni conciliación de Mercado Pago.
- Pantalla de superadmin: el dueño del producto carga pagos y cambia planes con un script.
- Cobrar impuestos, facturas o prorrateos al cambiar de plan.

## Decisions

- **Tres tablas: `plans`, `club_subscriptions`, `subscription_payments`.** El nombre evita `membership` porque `memberships` ya son los roles del equipo. `plans` guarda `max_courts` (nulo = sin tope) y los precios mensual y anual, así cambiar un precio es un `update` y no un deploy.
- **El estado se calcula, no se guarda.** `club_subscriptions` guarda solo hechos (`status` = `trial`, `active` o `canceled`, `trial_ends_on`, `paid_until`, `grace_days`) y la función `club_subscription_status` deriva *prueba / al día / en gracia / vencido* comparando con la fecha de hoy. Así no hace falta un cron que "venza" clubes ni hay estados desactualizados. Alternativa descartada: columna `state` mantenida por un proceso programado.
- **Fechas como `date` en horario de Buenos Aires** (`America/Argentina/Buenos_Aires`). El último día de la prueba o del período está incluido; la gracia corre desde el día siguiente. Un `timestamptz` obligaría a explicar a qué hora "vence" un club.
- **Un club `canceled` conserva el servicio hasta `paid_until` y después queda vencido sin gracia.** El estado existe para cuando Mercado Pago avise una baja; hoy solo lo puede poner el dueño a mano.
- **Plan inicial según las canchas de `create_club`.** Se redefine `create_club` (copiando la versión de 0008) para insertar primero la suscripción con el plan más chico que alcance (≤ 3 → Inicial, ≤ 6 → Club, más → Gran Club) y después las canchas. Así el límite no rechaza el alta del propio club. Los clubes que ya existan al aplicar la migración reciben una prueba de 30 días desde ese día, con el plan que corresponde a sus canchas activas.
- **Pagos solo por `register_subscription_payment(...)`**, función SECURITY DEFINER con `execute` revocado a `public`, `anon` y `authenticated` y concedido a `service_role`. Recibe club, monto, ciclo, estado, `mp_payment_id` y los demás datos externos, y en una sola transacción inserta el pago y, si está aprobado, activa la suscripción y extiende `paid_until` (`greatest(vencimiento vigente, fecha de pago)` + 1 mes o 1 año). Es idempotente por `mp_payment_id` único: repetido, no hace nada; si el pago existía pendiente y llega aprobado, se actualiza y recién ahí extiende. Hoy la llama el script; mañana, el webhook, sin cambiar nada.
- **Sin políticas de escritura** en las tres tablas: con RLS activado y sin políticas, ningún usuario escribe; solo el service role. Lectura: `plans` para cualquier usuario con sesión; `club_subscriptions` y `subscription_payments` solo para el admin del club.
- **`club_subscription_status(club_id)` devuelve `jsonb`** (estado, plan, ciclo, fechas, días restantes, canchas usadas y límite, `can_write`) y exige `is_member`, para que el aviso del panel lo vean todos los roles sin exponer montos. Una función interna `club_effective_state(club_id)` (sin chequeo de sesión, sin permiso para `authenticated`) la usan los triggers.
- **Solo lectura con un trigger genérico, no reescribiendo políticas.** `enforce_subscription_writable()` corre `BEFORE INSERT OR UPDATE OR DELETE` en `courts`, `reservations`, `reservation_participants`, `reservation_series`, `payments`, `credit_balances`, `settings`, `sport_prices`, `players`, `memberships` y `club_invitations`, y rechaza si el estado del club es vencido. Es una función y un `create trigger` por tabla, frente a reescribir ~35 políticas con una condición nueva. Se saltea cuando `auth.uid()` es nulo (service role, mantenimiento), y `audit_log` y `profiles` quedan afuera: el perfil es personal y la auditoría solo registra. El mensaje es: "La suscripción del club está vencida: solo podés consultar la información hasta regularizar el pago."
- **Límite de canchas con un trigger en `courts`** (`BEFORE INSERT OR UPDATE OF active`). Cuenta las canchas activas del club y compara con `max_courts`; antes toma `for update` sobre la fila de `club_subscriptions` para que dos altas simultáneas no pasen el límite. Cambiar de plan a uno menor por debajo de las canchas activas lo rechaza el script, no el trigger.
- **Pantalla y aviso en el servidor.** `lib/subscription.ts` llama a la función una vez por carga; el aviso va en `components/shell/dashboard-shell.tsx` y la página de Suscripción pasa a Server Component que lee planes, suscripción y pagos. Solo el botón de pago es un componente cliente (deshabilitado, "Próximamente"). Los formularios del panel ya muestran el mensaje de error del servidor, así que el rechazo del trigger se ve sin código extra; se verifica en la implementación.
- **Script `scripts/subscription-admin.mjs`** con tres comandos: `status <club>`, `pay <club> --amount --cycle [--mp-payment-id ...]` y `plan <club> <plan>` (que no deja bajar a un plan menor que las canchas activas). Usa `SUPABASE_SECRET_KEY` y nunca imprime claves.

## Risks / Trade-offs

- [El trigger de solo lectura frena una operación legítima del propio sistema, como una invitación aceptada por una persona que ya está en el club] → se acepta: es una alta de equipo. Las funciones del sistema que escriben con `auth.uid()` nulo (service role) no se ven afectadas.
- [Un club olvidado en gracia nunca recibe aviso por correo] → fuera de alcance; solo hay aviso en el panel. Se anota para cuando se defina Notificaciones.
- [El límite de canchas contra un plan que el club no pidió elegir] → mientras no haya pago online, el cambio de plan lo hace el dueño con el script; el mensaje del límite invita a pedirlo. El botón de plan queda "Próximamente".
- [Un doble registro manual del mismo pago sin `mp_payment_id`] → sin identificador no hay idempotencia; el script pide confirmación y muestra el último pago del club antes de registrar.
- [Precios de planes cambian y los pagos viejos quedan con otro monto] → el pago guarda el monto cobrado y el plan, así que el historial no cambia.

## Migration Plan

1. Escribir `0013_club_subscriptions.sql` (después de 0012) y `supabase/rollback/0013_down.sql` (vuelve a la versión de `create_club` de 0008/0012 y borra triggers, funciones y tablas).
2. Probar en local subir → bajar → subir, y los escenarios de los specs: club nuevo con plan según canchas, prueba, gracia, vencido, pago, pago repetido, límite de canchas y aislamiento entre clubes.
3. Implementar `lib/subscription.ts`, la pantalla, el aviso y el script.
4. Aplicar en la base real con confirmación del usuario; como la base está vacía, no hay clubes que migrar, pero la migración igual cubre los existentes.
5. Antes de publicar: registrar a mano el primer pago de cada club cuando termine su mes gratis.
