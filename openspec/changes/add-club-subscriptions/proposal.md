## Why

Cada club es un cliente que paga una suscripción mensual por usar la aplicación, y hoy no hay dónde saber si está al día: la pantalla de Suscripción muestra planes de ejemplo (datos mock) y la base no guarda planes, vencimientos ni pagos. Antes de publicar hay que dar el primer mes gratis, cobrar desde el segundo, llevar el historial mes a mes y limitar la cantidad de canchas según el plan. El cobro será por Mercado Pago, pero la integración viene después: ahora se deja el modelo listo para enchufarla sin tocar la estructura.

## What Changes

- Tabla `plans` con tres planes: **Inicial** (hasta 3 canchas, $15.000/mes), **Club** (hasta 6, $25.000/mes) y **Gran Club** (7 o más, $35.000/mes). El límite cuenta canchas de cualquier tipo. Precio anual con 10 % de descuento.
- Tabla `club_subscriptions` (una por club): plan, ciclo (mensual o anual), estado, fin de la prueba de 30 días, fin del período pagado y días de gracia (5 por defecto).
- Tabla `subscription_payments`: un registro por pago con monto, moneda, período cubierto, medio (`mercadopago`), estado y los campos externos de Mercado Pago ya previstos (`mp_payment_id` único para que un webhook repetido no duplique, `mp_preapproval_id`, `external_reference` y el JSON crudo).
- Función `club_subscription_status(club_id)`: dice si el club está en prueba, al día, en gracia o vencido, con días restantes, canchas usadas y límite. Se calcula con las fechas: no hace falta ningún proceso programado.
- Función `register_subscription_payment(...)`, solo para el service role: registra un pago aprobado y extiende el período. Es lo que hoy usa un script a mano y lo que mañana llamará el webhook de Mercado Pago.
- Al crear un club se crea su suscripción en prueba, con el plan más chico que alcance para las canchas que cargó.
- **Límite de canchas**: no se puede crear ni reactivar una cancha por encima del límite del plan.
- **Modo solo lectura**: pasados los días de gracia sin pago, el club sigue entrando y viendo todo, pero no puede crear ni editar turnos, cobros, canchas, precios, jugadores ni equipo hasta que se registre un pago. El acceso nunca se bloquea.
- `/dashboard/suscripcion` deja de usar datos de ejemplo: muestra plan actual, estado, vencimiento, días restantes, canchas usadas contra límite e historial de pagos. El botón de pagar queda deshabilitado con "Próximamente".
- Aviso en el panel cuando la prueba está por terminar, el club entró en gracia o quedó en solo lectura.
- Migración `0013_club_subscriptions.sql`, su `supabase/rollback/0013_down.sql` y un script para que el dueño del producto registre pagos.
- **No incluye**: SDK, checkout ni webhook de Mercado Pago, ni pantalla de superadmin.

## Capabilities

### New Capabilities
- `club-subscriptions`: planes, suscripción de cada club, prueba gratis, pagos mensuales, estado "al día" y pantalla de Suscripción. Reemplaza a `subscription/plans` del cambio `sports-club-management-mvp` (que era solo de ejemplo).
- `subscription-enforcement`: límite de canchas por plan y modo solo lectura cuando el club no paga.

### Modified Capabilities

## Impact

- Base: migración 0013 (3 tablas, 2 funciones de consulta/registro, trigger de límite de canchas, trigger de solo lectura en las tablas del club, ajuste de `create_club`). La numeración 0012 es de `rename-socios-to-players` y 0010 de `add-night-pricing`, así que se aplica después de 0012.
- Código: `app/dashboard/suscripcion/`, `lib/subscription.ts` (nuevo), aviso en `components/shell/dashboard-shell.tsx`, mensajes de error en las acciones del panel, `scripts/register-subscription-payment.ts` (nuevo) y se quita `SUBSCRIPTION_PLANS` de `lib/mocks/data.ts`.
- Se mantiene el nombre `memberships` para los roles del equipo; la suscripción nunca usa la palabra "membership".
- Variables: el script usa `SUPABASE_SECRET_KEY`, que ya existe.
