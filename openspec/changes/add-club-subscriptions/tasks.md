## 1. Base de datos

- [x] 1.1 Migración `0013_club_subscriptions.sql`, parte 1: tablas `plans` (con los tres planes cargados), `club_subscriptions` y `subscription_payments` con sus restricciones, índices, RLS (sin políticas de escritura) y lectura según el spec; verificar en local que el admin lee su suscripción y sus pagos, que otro club no los ve y que un `insert` con sesión de usuario falla
- [x] 1.2 Migración, parte 2: `club_effective_state`, `club_subscription_status` (jsonb, exige `is_member`) y `register_subscription_payment` (idempotente por `mp_payment_id`, extiende `paid_until`, solo `service_role`); verificar con fechas simuladas los escenarios de estado (prueba día 10, gracia a los 3 días, vencido a los 6) y de pago (primer pago, adelantado, repetido, pendiente → aprobado, rechazado)
- [x] 1.3 Migración, parte 3: triggers de límite de canchas (con `for update`) y de solo lectura (`enforce_subscription_writable` en las 11 tablas del club); verificar que la 4.ª cancha del plan Inicial falla, que dar de baja y crear otra anda, que reactivar por encima del límite falla y que un club vencido no puede insertar turnos pero sí leer
- [x] 1.4 Migración, parte 4: `create_club` redefinida (suscripción en prueba con el plan según las canchas) y alta de la suscripción de los clubes existentes; verificar que un club con 2, 5 y 9 canchas queda en Inicial, Club y Gran Club, y que la creación del club sigue andando
- [x] 1.5 `supabase/rollback/0013_down.sql` y prueba subir → bajar → subir en local sin errores; después de bajar, `create_club` vuelve a crear clubes sin suscripción

## 2. Código del panel

- [x] 2.1 `lib/subscription.ts`: tipos, lectura del estado con la función, textos en voseo ("Prueba gratis", "Al día", "En gracia", "Vencida") y cálculo de cuándo mostrar el aviso; verificar con `pnpm exec tsc --noEmit` y pruebas de los textos por estado
- [x] 2.2 Aviso en `components/shell/dashboard-shell.tsx`: prueba o período a 7 días o menos, gracia y vencido, con enlace a Suscripción solo para el admin; verificar los cuatro casos (sin aviso, prueba por terminar, gracia, vencido) cambiando fechas en local
- [x] 2.3 Pantalla `/dashboard/suscripcion` real: plan actual, estado, vencimiento, días restantes, canchas usadas contra límite, planes con el actual destacado, alternador mensual/anual y historial de pagos; botón de pago deshabilitado con "Próximamente"; quitar `SUBSCRIPTION_PLANS` de `lib/mocks/data.ts`; verificar a 1440 y 390 px y que un operador no accede
- [x] 2.4 Mensajes de rechazo: comprobar que alta de turno, cobro, alta de cancha, de jugador y de equipo muestran el mensaje de suscripción vencida o de límite de canchas en lugar de un error genérico; ajustar las acciones que lo oculten

## 3. Herramienta del dueño del producto

- [x] 3.1 `scripts/subscription-admin.mjs` con `status <club>`, `pay <club> --amount --cycle [--mp-payment-id]` y `plan <club> <plan>` (rechaza un plan menor que las canchas activas, pide confirmación y no imprime claves); verificar contra el Supabase local que `pay` extiende el vencimiento y que repetir el mismo `--mp-payment-id` no duplica

## 4. Verificación y documentación

- [x] 4.1 Recorrido completo en local: club nuevo → prueba con aviso → forzar fin de prueba → gracia → vencido (solo lectura, perfil sigue andando) → `pay` → vuelve a operar sin cerrar sesión; persona en dos clubes con uno vencido opera en el otro
- [x] 4.2 Actualizar README y `docs/PROJECT_DOCUMENTATION.md` (tablas, funciones, planes, script, qué falta de Mercado Pago) y agregar los puntos a `docs/next-steps.md`: pruebas manuales y "integrar Mercado Pago (checkout de suscripción + webhook sobre `register_subscription_payment`)"
- [x] 4.3 Aplicar `0013` en la base real con confirmación del usuario y verificar que existen las tablas, los tres planes y las funciones — aplicada el 2026-10-18 (3 planes, 6 funciones y 12 triggers en producción)
