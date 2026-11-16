> **Origen:** etapa 1 aprobada por Mau (2026-11-15), a partir de la planilla en papel del club (fotos en `docs/`): cambio inicial, accesorios, "Gastos y liquidaciones", "Gastos MP" y el cierre con ingresos, egresos y Mercado Pago.

## Why

La Caja solo mostraba los cobros de turnos. En el club la caja del día también tiene la venta de accesorios (pelotas, grips, agua), las liquidaciones a los profes, los gastos y los retiros, y se cobra casi todo en efectivo o por Mercado Pago. Sin eso, la planilla de papel sigue siendo la fuente de verdad del cierre.

## What Changes

- **Mercado Pago como medio de cobro:** `payments.method` acepta `mercado_pago`. Al cobrar un turno o cargar un movimiento solo se ofrecen Efectivo y Mercado Pago (`VISIBLE_PAYMENT_METHODS`); transferencia y otro siguen válidos para cobros viejos y se muestran si existen.
- **Movimientos de caja (`cash_movements`):** entradas (accesorio, otro ingreso) y salidas (liquidación de profe, empleado, proveedor, gasto general, retiro), con concepto, a quién, cantidad, monto, medio y nota. Nunca se borran: se anulan y quedan tachados.
- **Cambio inicial (`cash_openings`):** un monto por club y día.
- **Pantalla Caja:** "Registrar venta" (producto con sugerencias de lo ya vendido y su último precio, precio, cantidad y medio), "Registrar salida" (solo admin), cambio inicial editable (solo admin), totales por medio, "Efectivo en caja" = cambio + entradas en efectivo − salidas en efectivo, lista de entradas que mezcla cobros de turnos y ventas, y salidas separadas en "Gastos y liquidaciones" (efectivo) y "Gastos MP".
- **Permisos:** el operador ve la Caja y registra ventas; salidas, cambio y anulación son del admin. Lo aplican RLS y las Server Actions.
- **Auditoría:** `cash.movement_created`, `cash.movement_voided` y `cash.opening_set` en Actividad.

## Capabilities

### New Capabilities
- `cash-register`: movimientos de caja, cambio inicial y cuentas del día (`summarizeCashDay`, que también usa el cierre del día de Reportes).

## Impact

- **Base de datos:** `0025_cash_register.sql` (check de `payments.method`, tablas `cash_movements` y `cash_openings` con RLS, trigger que solo permite anular, triggers de solo lectura por suscripción) y `supabase/rollback/0025_down.sql`.
- **Código:** `lib/cash.ts`, `lib/reservations.ts` (medios), `app/dashboard/caja/` (página y acciones), `components/cash/`, detalle del turno (medios visibles), `lib/audit.ts`, menú y matriz de permisos.
- **Fuera de alcance:** stock de accesorios, arqueo con diferencia de caja, varias cajas por día.
