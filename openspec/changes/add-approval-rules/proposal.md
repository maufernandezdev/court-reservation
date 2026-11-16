> **Origen:** etapa 1 aprobada por Mau (2026-11-15). En algunos horarios (por ejemplo, de lunes a viernes desde las 19:00) el admin quiere decidir quién juega. Flujo elegido: el pedido se hace en la app.

## Why

Hoy cualquier persona del equipo que reserva deja el turno confirmado. En las franjas más pedidas el admin quiere ver y aprobar los turnos que cargan operadores, profes u organizadores antes de que queden firmes, sin perder el lugar mientras tanto.

## What Changes

- **Franjas con confirmación (`approval_rules`):** todas las canchas o una; días de la semana o una fecha puntual; desde y hasta. Se cargan y se quitan en Políticas (solo admin).
- **Turno por confirmar:** si operador, profe u organizador reserva o mueve un turno dentro de una franja, queda en `pending_approval`. Ocupa el lugar (el índice único de slot lo incluye), se ve rayado en la planilla y el formulario avisa antes de guardar. El admin reserva sin confirmación. Lo aplica un trigger de la base (`enforce_reservation_approval`).
- **Confirmar o rechazar:** el admin ve "Para confirmar" en Hoy y un contador en el menú; confirma (`active`, `approved_by` / `approved_at`) o rechaza (`rejected`, `rejected_by` / `rejected_at`, motivo opcional; libera el lugar). Solo el admin puede hacerlo (trigger).
- **Quien pidió:** ve el estado en el detalle y en Hoy ("Tus pedidos de horario") y tiene "Avisar al admin por WhatsApp" con el mensaje armado.
- **Reglas existentes:** los turnos por confirmar o rechazados no admiten cobros; un fijo dentro de una franja lo carga el admin; `ensure_series_until`, la disponibilidad (`lib/availability`), los huecos libres de Hoy y los chequeos de choque cuentan los pendientes como ocupados; un rechazado se trata como cancelado.

## Capabilities

### New Capabilities
- `approval-rules`: franjas con confirmación, estados `pending_approval` y `rejected`, confirmación del admin.

## Impact

- **Base de datos:** `0028_approval_rules.sql` (tabla y RLS, estados, columnas de decisión, índice de slot, `requires_approval`, trigger, vista `reservation_board` con las columnas nuevas, `ensure_series_until` con pendientes) y `supabase/rollback/0028_down.sql`.
- **Código:** `lib/approval.ts`, `lib/reservations.ts` (estados, `occupiesSlot`), `lib/availability.ts`, `lib/daily-overview.ts`, `lib/reservation-tone.ts`, acciones de turnos (confirmar, rechazar, guardas), formulario, detalle (`ApprovalBox`), Hoy (`ApprovalRequests`), Políticas (`ApprovalRulesCard`), menú y barra inferior (contador), layout del panel.
- **Fuera de alcance:** avisos automáticos (correo o push), aprobación por WhatsApp sin entrar a la app.
