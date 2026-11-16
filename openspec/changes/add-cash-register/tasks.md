## 1. Base de datos

- [x] 1.1 Migración `0025_cash_register.sql`: `mercado_pago` en `payments.method`, `cash_movements` (RLS: staff lee, operador inserta solo entradas, admin inserta salidas y anula; trigger que solo deja anular) y `cash_openings` (solo admin escribe); `supabase/rollback/0025_down.sql`
- [x] 1.2 Aplicar en la base real (`supabase db push`) — aplicada el 2026-11-15 en `ddzxywqtnmibrctevmew`

## 2. Dominio y acciones

- [x] 2.1 `lib/cash.ts`: categorías, esquemas Zod (venta, salida, cambio) y `summarizeCashDay`
- [x] 2.2 `app/dashboard/caja/actions.ts`: registrar venta (operador), registrar salida, anular y cambio inicial (admin), con auditoría
- [x] 2.3 Medios visibles (Efectivo y Mercado Pago) en el cobro del turno; transferencia y otro solo para mostrar cobros viejos

## 3. Pantalla

- [x] 3.1 Caja: botones de venta y salida, cambio inicial, totales por medio, efectivo en caja, entradas mezcladas, "Gastos y liquidaciones" y "Gastos MP", anular con confirmación
- [x] 3.2 Menú y barra inferior: Caja visible para el operador; matriz de permisos de Equipo actualizada

## 4. Verificación

- [x] 4.1 En localhost (base real) como admin: venta con cantidad y MP, sugerencia del producto vendido, cambio inicial, liquidación en efectivo, gasto MP, anular (tachado, deja de sumar); como operador: registra venta, no ve salida ni cambio; RLS rechaza salida, anulación y cambio del operador por API
- [x] 4.2 Caja a 390 px sin scroll horizontal
- [x] 4.3 `pnpm exec tsc --noEmit` y `pnpm build`
