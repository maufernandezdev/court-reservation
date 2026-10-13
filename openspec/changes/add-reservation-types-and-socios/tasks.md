Cada fase termina con `pnpm exec tsc --noEmit`, `pnpm build`, la recorrida de las pantallas tocadas contra el Supabase local (Playwright a 1440 y 390 px) y un commit propio. Al terminar cada punto de `docs/next-steps.md`, marcarlo como aplicado.

## 1. Migración `0008_reservation_types_and_socios.sql`

- [ ] 1.1 Tablas `socios`, `sport_prices`, `reservation_participants` y `reservation_series` con RLS por club (miembros leen; staff escribe socios, personas y series; admin escribe precios) y verificar en local con usuarios de dos clubes que no se ven datos cruzados
- [ ] 1.2 Columnas nuevas: `reservations.kind`, `profe_user_id`, `price`, `series_id` (con checks y `unique (series_id, date)`), `settings.tournament_duration_minutes` y `memberships.color`; verificar que el código actual sigue funcionando con la migración aplicada (es aditiva)
- [ ] 1.3 Backfills: `sport_prices` desde las canchas (precio y seña de la cancha activa más cara por deporte, profe = público), `reservations.price` con el valor que tenían y una persona (posición 1) por turno existente; verificar en local que los valores de Hoy y Caja no cambian
- [ ] 1.4 `create_club` crea las filas de `sport_prices` de los deportes elegidos; función `ensure_series_until(p_club_id, p_until)` idempotente que materializa fechas faltantes salteando superposiciones; verificar desde SQL que dos llamadas seguidas no duplican fechas
- [ ] 1.5 `supabase/rollback/0008_down.sql` y prueba subir → bajar → subir en local sin perder turnos

## 2. Precios por deporte

- [ ] 2.1 `lib/pricing.ts`: `quotePrice` (deporte, tipo, duración) y `depositFor` sobre el valor fijado; reemplazar `getSlotPrice`/`getDepositAmount` en cobros, cancelación, detalle, Hoy (`lib/daily-overview.ts`), Caja y buscador; verificar que un cambio de precio no altera turnos existentes
- [ ] 2.2 Sección "Precios" en Canchas (una tarjeta por deporte del club: público, profe y seña, RHF + Zod, solo admin, auditoría `prices.updated`) y formulario de cancha sin precio ni seña (alta de cancha de un deporte nuevo crea su fila de precios); verificar los escenarios de `sport-pricing`
- [ ] 2.3 Políticas: sección "Torneos" con la duración estándar (pasos de 30); verificar que solo el admin la cambia y que el ejemplo de cancelación usa los precios por deporte

## 3. Socios

- [ ] 3.1 Pantalla Socios real: listado con búsqueda (nombre, DNI, teléfono), "Agregar socio", editar y dar de baja (diálogos RHF + Zod), sin cuota, visible para admin y operador; acciones con auditoría `socio.created/updated/removed`; verificar los escenarios de `club-socios` (incluido DNI repetido y profesor sin acceso)
- [ ] 3.2 Agregar el componente `command` de shadcn con el CLI y crear `PeopleCombobox` (sugerencias de socios por nombre o DNI, Enter fija persona no socia, chips quitables, máximo configurable); verificar con teclado y a 390 px

## 4. Tipos de turno y personas

- [ ] 4.1 Formulario del turno: tipo (Estándar / Profe / Torneo; el profesor no elige), profe (staff), personas con `PeopleCombobox` (1–4; torneo mínimo 2), teléfono desde quien reserva, duración editable solo en torneo y valor según `quotePrice`; schema Zod en el formulario; verificar validaciones en español
- [ ] 4.2 Server Actions de alta y edición: validan tipo, profe del club, personas y duración; fijan `price`; guardan personas (con compensación si fallan); auditoría con tipo y personas; verificar los escenarios de `reservation-types` (profe forzado, profe sin elegir, torneo de 1 persona, torneo de 90 y 120 min, superposición)
- [ ] 4.3 Color de profe: `lib/profe-colors.ts`, asignación automática al sumarse o pasar a profesor, selector en Equipo (solo admin); verificar que el color nuevo se ve en la planilla
- [ ] 4.4 Distinción visual (`kindStyle`) en grilla, planilla del celular, Hoy y detalle, y leyenda de tipos; revisar contraste y verificar el escenario de la planilla con tipos mezclados a 1440 y 390 px

## 5. Turnos fijos

- [ ] 5.1 Opción "Repetir todas las semanas" en el alta (estándar y profe): crea la serie, materializa 8 semanas y muestra las fechas salteadas; verificar el escenario de semana ocupada
- [ ] 5.2 Planilla, Hoy y buscador llaman a `ensure_series_until` con la fecha mostrada; verificar que un fijo aparece al navegar seis meses adelante
- [ ] 5.3 Detalle del turno fijo: ícono y texto "Fijo · todos los lunes 09:00", "Dar de baja desde esta fecha" (staff y profe dueño) que libera fechas sin cobros y lista las que tienen cobros; auditoría `series.created/ended`; verificar los escenarios de baja y de fecha con cobro, y que cancelar una fecha suelta no afecta las demás

## 6. Cierre

- [ ] 6.1 Recorrido completo en local: precios de tenis y pádel, socios, turno estándar con socio, turno de profe cargado por el operador y por el profe, torneo singles y dobles con duración cambiada, fijo con baja, cobro y cancelación de cada tipo, Caja y Actividad
- [ ] 6.2 Aplicar `0008` en producción con confirmación del usuario y repetir conteos
- [ ] 6.3 Actualizar README, `docs/PROJECT_DOCUMENTATION.md` y marcar en `docs/next-steps.md` los puntos aplicados; marcar `add-fixed-reservations` como absorbido por este cambio
