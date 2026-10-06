# Tasks — add-club-operations-foundation

> **Estado (2026-10-01):** implementación completa y aprobada en revisión. Bloqueado en la aplicación de las migraciones a Supabase (ver "Pendientes" en `docs/PROJECT_DOCUMENTATION.md`). Las tareas 1.3, 2.2, 3.3 y 11.2 dependen de eso.

## 1. Base de datos: membresías y RLS por club

- [x] 1.1 Crear `supabase/migrations/0004_memberships_and_rls.sql`: tabla `memberships (id, owner_id, user_id, role, full_name, created_at, UNIQUE(owner_id, user_id))`, función `SECURITY DEFINER is_member(owner_id uuid)`, índices, RLS habilitado, backfill de membresía `admin` por cada `user_id` existente en `courts` o `reservations`, y verificar que el SQL es idempotente (IF NOT EXISTS)
- [x] 1.2 En el mismo archivo, reemplazar policies de `courts` y `reservations` para usar `is_member(owner_id)` en lugar de `user_id = auth.uid()` (DROP de policies viejas + CREATE nuevas), manteniendo el trigger `check_reservation_court_owner`
- [ ] 1.3 Aplicar 0004 en el SQL Editor de Supabase y verificar con dos usuarios: ambos ven solo datos de clubes donde son miembros

## 2. Base de datos: configuración de negocio en canchas

- [x] 2.1 Crear `supabase/migrations/0005_courts_business_config.sql`: en `courts` agregar `price_per_hour numeric(10,2) NOT NULL DEFAULT 0`, `slot_duration int NOT NULL DEFAULT 60`, `open_time time NOT NULL DEFAULT '09:00'`, `close_time time NOT NULL DEFAULT '22:00'`, `deposit_enabled bool NOT NULL DEFAULT false`, `deposit_type text NOT NULL DEFAULT 'percent'`, `deposit_value numeric(10,2) NOT NULL DEFAULT 0`, con CHECKs de rango (slot_duration IN 30/60/90, deposit_type IN fixed/percent, horarios coherentes) y verificar que filas existentes quedan con defaults
- [ ] 2.2 Aplicar 0005 y verificar en Table Editor que las canchas existentes tienen precio 0, duración 60 y seña deshabilitada

## 3. Base de datos: ciclo de vida de reservas, pagos, políticas y auditoría

- [x] 3.1 Crear `supabase/migrations/0006_reservations_lifecycle.sql`: en `reservations` agregar `duration_minutes int NOT NULL DEFAULT 60`, `status text NOT NULL DEFAULT 'active'`, `payment_status text NOT NULL DEFAULT 'pendiente'`, `cancelled_at timestamptz`, `cancelled_by uuid`, `cancel_reason text`, `late_cancel bool NOT NULL DEFAULT false`, `created_by uuid`, `updated_by uuid`, `updated_at timestamptz`; backfill `created_by`/`updated_by` = `user_id` de cada fila
- [x] 3.2 En el mismo archivo: DROP del constraint único viejo y CREATE de índice único parcial `UNIQUE(court_id, date, time) WHERE status = 'active'`; tablas `payments`, `settings (owner_id PK, cancel_window_hours int default 24, late_penalty_percent numeric default 50)`, `credit_balances (owner_id, customer_phone, amount, UNIQUE(owner_id, customer_phone))`, `audit_log`; trigger `set_updated_at` en `reservations`; policies RLS para las 4 tablas nuevas con `is_member`; verificar SQL completo sin errores
- [ ] 3.3 Aplicar 0006 y verificar: cancelar una reserva de prueba (UPDATE status='cancelled') libera el turno para una nueva reserva misma cancha/fecha/hora (el índice parcial lo permite) y la fila cancelada sigue existiendo

## 4. Capa de dominio (lib/)

- [x] 4.1 Crear `lib/roles.ts` con tipos `ClubRole`, helper `getMyMemberships()` (server) y `requireRole(minimum: ClubRole)` que lanza si el rol no alcanza, y verificar que compila con `pnpm exec tsc --noEmit`
- [x] 4.2 Crear `lib/pricing.ts` con `getSlotPrice(court, durationMinutes)` y `getDepositAmount(court, durationMinutes)` (fijo o %; lanza/error si la seña supera el valor del turno) y tests manuales de casos: 90 min a $8.000/h con 50% → seña $6.000
- [x] 4.3 Crear `lib/availability.ts` con `getCourtSlots(court, date)` (franjas open_time→close_time según slot_duration), `findFreeSlots(courts, date, {from?, to?, type?})` (excluye reservas activas y solapamientos por duración), y verificar contra datos de prueba
- [x] 4.4 Extender schema Zod de cancha en `lib/courts.ts` con los nuevos campos (precio > 0, slot_duration enum, horarios, seña) con mensajes en español

## 5. UI: gestión de canchas completa

- [x] 5.1 Actualizar `components/courts/new-court-dialog.tsx` y `app/dashboard/canchas/actions.ts` con los campos nuevos (precio, duración, horarios, seña con toggle y switch fijo/%) usando RHF+Zod, y verificar que crear una cancha con seña del 30% persiste todo
- [x] 5.2 Actualizar `components/courts/court-card-actions.tsx` para editar los mismos campos, y verificar que editar el precio se refleja en la planilla
- [x] 5.3 Mostrar precio/hora y duración en las tarjetas de cancha (`app/dashboard/canchas/page.tsx`), y verificar visualmente

## 6. UI: miembros y roles

- [x] 6.1 Crear `app/dashboard/miembros/page.tsx` con Server Action `inviteMember` (email + rol, validado con Zod) que inserta en `memberships`, lista de miembros con rol, y verificar que el admin invita un operador y este puede operar las canchas del club
- [x] 6.2 Proteger `app/dashboard/miembros` y la futura configuración para `admin` únicamente (redirect desde la Server Action y UI), y verificar que un operador recibe error/redirect
- [x] 6.3 Agregar item "Miembros" en la sidebar (`app/dashboard/layout.tsx`) visible solo para admin, y verificar que el operador no lo ve

## 7. UI: configuración de políticas de cancelación

- [x] 7.1 Crear `app/dashboard/configuracion/page.tsx` con formulario (Zod) de `cancel_window_hours` y `late_penalty_percent`, Server Action `saveSettings` solo admin con upsert en `settings`, y verificar que persiste tras recargar
- [x] 7.2 Agregar item "Configuración" en la sidebar solo para admin

## 8. Lógica de reservas: cancelación con penalidad, cobros y saldo a favor

- [x] 8.1 Refactor `hooks/use-reservations.ts` y `app/dashboard/reservas/page.tsx`: al crear reserva guardar `duration_minutes` según la cancha y calcular mostrar valor del turno y seña; verificar que dos reservas no se solapan en el mismo turno
- [x] 8.2 Implementar flujo de cancelación (reemplazar hard delete): Dialog con motivo opcional que calcula si es tardía (settings + inicio del turno), registra `status='cancelled'`, `late_cancel`, `cancelled_by`, libera turno; si era tardía y había seña cobrada la retiene, si no había seña registra deuda en `credit_balances`; verificar ambos caminos
- [x] 8.3 Implementar restricción del rol `profesor`: rechazar cancelación dentro de la ventana con mensaje en español ("Debés consultar con un administrador…"), verificar que admin/operador sí pueden
- [x] 8.4 Implementar registro de cobros: en el detalle de reserva, acciones "Registrar seña" y "Registrar pago total" (método: efectivo/transferencia/otro) que insertan en `payments` y actualizan `payment_status`; verificar transición pendiente→senada→pagada
- [x] 8.5 Implementar aplicación de saldo a favor: al crear reserva, si el cliente (teléfono) tiene saldo, ofrecer aplicarlo (descuenta del monto y decrementa `credit_balances`), y verificar el cálculo

## 9. Auditoría

- [x] 9.1 Escribir entradas en `audit_log` desde las acciones de reservas (crear/modificar/cancelar/cobrar/aplicar saldo) con actor, entidad y payload esencial, y verificar que quedan registros tras operar
- [x] 9.2 Mostrar en el Dialog de detalle de reserva el historial de acciones (solo admin ve log completo; operador/profe ven autor de última modificación), y verificar visualmente

## 10. Planilla mobile-first + buscador de disponibilidad

- [x] 10.1 Crear hook `hooks/use-media-query.ts` y vista mobile de la planilla (selector de cancha + lista vertical de franjas con estado y acciones), manteniendo grid en desktop, y verificar en viewport móvil (Playwright) que no hay scroll horizontal y se puede crear/editar/cobrar/cancelar
- [x] 10.2 Crear Dialog "Buscar disponibilidad" (fecha, franja opcional, tipo) que lista slots libres con `findFreeSlots` y permite crear reserva directo desde el resultado, y verificar la consulta "pádel mañana por la tarde"
- [x] 10.3 Verificar responsive del resto de páginas tocadas (canchas, miembros, configuración) en viewport 375px

## 11. Verificación integral y documentación

- [x] 11.1 `pnpm exec tsc --noEmit` y `pnpm build` sin errores
- [ ] 11.2 Flujo E2E manual con dos usuarios: admin invita operador, operador crea cancha con seña, crea reserva, cobra seña, cancela tardía (seña retenida), verifica auditoría y aislamiento de datos entre clubes
- [x] 11.3 Actualizar `docs/PROJECT_DOCUMENTATION.md` con las nuevas tablas/columnas, el modelo de roles, y el recordatorio de que Mercado Pago queda modelado (payments.external_ref) sin integrar
