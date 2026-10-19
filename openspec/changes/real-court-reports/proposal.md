> **Origen:** pedido del usuario (2026-10-18): la pantalla Reportes quedó con datos de ejemplo (ingresos, ocupación y stock de productos inventados); que muestre algo real sobre las canchas y sin stock.

## Why

`/dashboard/reportes` lee datos de ejemplo (`lib/mocks/data.ts`) con un club ficticio y alertas de stock de un módulo de productos que hoy está oculto. El admin no puede usarla para nada real. Los datos que sí existen (turnos, cobros, canchas, horario del club) alcanzan para un reporte útil sobre cómo rinden las canchas.

## What Changes

- **Reportes con datos reales**, solo para el `admin`, por período: **Hoy, Ayer, Últimos 7 días y Este mes**.
- **Indicadores:** ingresos cobrados, turnos (con las cancelaciones), ocupación de las canchas y lo que falta cobrar.
- **Por cancha:** turnos, horas reservadas, ocupación e ingresos de cada una.
- **Horarios más pedidos** (cuántos turnos empiezan en cada hora) y **tipos de turno** (estándar, profe, torneo y fijos).
- **Para revisar** (reemplaza las alertas de stock): turnos de los últimos 30 días con saldo sin cobrar, cancelaciones tardías del período, deportes sin precio cargado y canchas sin turnos en el período.
- **Resumen para WhatsApp** con los números reales del período y un botón para copiarlo.
- Se **quita el stock** de Reportes (el módulo de productos sigue oculto, con su código).

## Capabilities

### New Capabilities
- `court-reports`: reporte de rendimiento de las canchas por período, con alertas y resumen para compartir.

### Modified Capabilities
<!-- No hay spec en openspec/specs/ de la pantalla de ejemplo original (`sports-club-management-mvp`, sin archivar). -->

## Impact

- **Código:** `app/dashboard/reportes/page.tsx` (pasa a Server Component), `lib/reports.ts` (cálculos puros), `components/reports/` (selector de período y copiado del resumen), documentación.
- **Base de datos:** sin cambios (se lee `reservations`, `payments`, `courts`, `settings` y `sport_prices`).
- **Fuera de alcance:** exportar a Excel/PDF, gráficos interactivos, comparar contra el período anterior, reportes de productos o de jugadores.
