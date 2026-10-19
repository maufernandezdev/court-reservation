## Context

`/dashboard/reportes` es un Client Component sobre `lib/mocks/data.ts`. Los datos reales ya existen: `reservations` (fecha, hora, duración, estado, tipo, valor, estado de pago, cancelación tardía), `payments` (tipo, monto, liberado, fecha de alta), `courts`, el horario del club y la hora de noche en `settings`, y `sport_prices`. Caja ya define qué es un ingreso. Hoy (`lib/daily-overview.ts`) ya calcula ocupación y lo pendiente de un día.

## Goals / Non-Goals

**Goals:** un reporte real y sobrio sobre las canchas, coherente con Caja y con Hoy.

**Non-Goals:** exportar, gráficos interactivos, comparación con períodos anteriores, reportes de productos o jugadores.

## Decisions

- **Server Component con el período en la URL** (`?periodo=hoy|ayer|7d|mes`, por defecto `hoy`), como Caja con la fecha. Los botones del período son enlaces; no hay estado de cliente salvo el botón de copiar.
- **Cálculos puros en `lib/reports.ts`** (`periodRange`, `buildReport`): reciben canchas, turnos, cobros, horario y hora de noche, y devuelven todo lo que muestra la pantalla; se prueban sin base. La página solo consulta y dibuja. La fecha de hoy y los períodos se calculan en horario de Buenos Aires.
- **Ingresos = señas y cobros por fecha de alta en el período, sin saldo aplicado**, igual que Caja, y se asignan a la cancha del turno al que pertenecen (consulta con `reservations(court_id)` embebida).
- **Ocupación con la misma base que Hoy** (minutos de turnos activos sobre minutos disponibles), pero con los días del período: para "Este mes" se cuentan los días transcurridos, no los futuros. Los turnos del período son los de esa fecha, hayan ocurrido o no (hoy incluye los que faltan).
- **Lo que falta cobrar** reutiliza `amountDue` / `paidByReservation` de `daily-overview` sobre los turnos activos del período con fecha hasta hoy.
- **Paginación de lecturas:** PostgREST devuelve hasta 1000 filas; un mes puede pasarlas, así que las lecturas de turnos y cobros se piden por páginas.
- **"Para revisar":** la deuda de los últimos 30 días se consulta aparte (turnos activos ya pasados con estado distinto de pagada y sus cobros), independiente del período elegido.
- **Resumen para WhatsApp** generado en el servidor y mostrado con un botón de copiar (Client Component mínimo).

## Risks / Trade-offs

- [Un mes con muchos turnos tarda más] → lecturas paginadas y solo las columnas necesarias; el volumen de un club es de unos pocos miles de filas al mes.
- [Ocupación engañosa con horario nuevo] → se calcula con el horario vigente del club, no con el que había cuando se reservó; se acepta (nota en la documentación).
- [El módulo de productos sigue oculto] → su código y sus datos de ejemplo quedan; solo se deja de mostrar el stock en Reportes.

## Migration Plan

Sin cambios de base. Reemplazar la página, agregar `lib/reports.ts` y los componentes, verificar con datos de prueba en el Supabase local y actualizar la documentación.
