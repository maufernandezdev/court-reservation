> **Origen:** etapa 1 aprobada por Mau (2026-11-15). En la planilla de papel cada turno lleva anotado cuánto pagó y cómo ("MP", "$22.000"), y al final del día se cierra con ingresos, egresos, MP y efectivo. Depende de `add-cash-register`.

## Why

En la planilla de la app no se veía cuánto valía cada turno ni cómo se cobró, y Reportes no tenía el cierre del día que el club hace a mano: había que cruzar Caja, la planilla y los reportes por período.

## What Changes

- **Cobro visible en la planilla:** cada turno (escritorio y celular) muestra valor, estado y medio del último cobro, por ejemplo "$18.000 · Pagado · MP". En turnos de 30 min la línea del horario deja lugar al cobro. Si quien mira no puede ver cobros (RLS), queda solo el estado.
- **Cierre del día en Reportes:** arriba de todo, para hoy o cualquier fecha (`?cierre=`): efectivo en caja, ingresos, egresos y Mercado Pago (los mismos números que Caja, con `summarizeCashDay`); ingresos por origen (turnos del público, de profes y de torneo, accesorios, otros); egresos por categoría; turnos jugados, cancelados y lo que falta cobrar.
- **Resumen de WhatsApp:** arranca con el cierre del día y sigue con el resumen del período.

## Capabilities

### New Capabilities
- `day-close`: cierre del día (`lib/day-close.ts`).

### Modified Capabilities
- `reservation-sheet`: los bloques de turno muestran el cobro.

## Impact

- **Base de datos:** sin migraciones.
- **Código:** `lib/day-close.ts`, `lib/reservation-tone.ts` (`paymentSummary`, `lastMethodByReservation`), `lib/club-data.ts` (cobros con medio y fecha), `schedule-grid`, `mobile-schedule`, `schedule-view`, Reportes y el selector de día (`CashDateNav` con parámetro configurable).
