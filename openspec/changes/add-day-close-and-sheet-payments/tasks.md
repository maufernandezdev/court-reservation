## 1. Planilla

- [x] 1.1 Cobros del día con medio y fecha; `lastMethodByReservation` y `paymentSummary` ("$18.000 · Pagado · MP")
- [x] 1.2 Grilla de escritorio y lista del celular con el cobro; recarga de cobros al guardar un turno o registrar un pago

## 2. Cierre del día

- [x] 2.1 `lib/day-close.ts`: `buildDayClose` (con `summarizeCashDay`), `loadDayClose` y líneas para WhatsApp
- [x] 2.2 Reportes: sección "Cierre del día" con selector de fecha (`?cierre=`), tarjetas, ingresos por origen, egresos por categoría y turnos
- [x] 2.3 El resumen de WhatsApp usa el cierre del día

## 3. Verificación

- [x] 3.1 En localhost (base real, solo lectura): Reportes con el cierre de hoy y la planilla a 1440 y 390 px mostrando "$30.000 · Pendiente"
- [x] 3.2 `pnpm exec tsc --noEmit` y `pnpm build`
