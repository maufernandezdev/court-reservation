Cada fase termina con `pnpm exec tsc --noEmit`, `pnpm build`, la recorrida de las pantallas tocadas contra el Supabase local (Playwright a 1440 y 390 px) y un commit propio. Al terminar cada punto de `docs/next-steps.md`, marcarlo como aplicado.

## 1. Migración `0008_reservation_types_and_socios.sql`

- [x] 1.1 Tablas `socios`, `sport_prices`, `reservation_participants` y `reservation_series` con RLS por club (miembros leen; staff escribe socios, personas y series; admin escribe precios) y verificar en local con usuarios de dos clubes que no se ven datos cruzados
  - Verificado en local (2026-10-12): el operador crea socios y el profesor no; el profe lee socios (para buscarlos); otro club no ve socios ni precios; DNI repetido → `socios_club_dni_idx`; el operador no cambia precios y el admin sí; el profe crea una serie propia de tipo profe y no una ajena.
- [x] 1.2 Columnas nuevas: `reservations.kind`, `profe_user_id`, `price`, `series_id` (con checks y `unique (series_id, date)`), `settings.tournament_duration_minutes` y `memberships.color`; verificar que el código actual sigue funcionando con la migración aplicada (es aditiva)
  - Columnas con defaults (`kind='standard'`, `price=0`) y check `reservations_profe_check`. Verificado: con 0008 aplicada, el build del código anterior pasa el recorrido de la fase 3 de `add-club-onboarding` (crear, cobrar y cancelar turno, permisos, aislamiento). Ojo: mientras no se despliegue el código nuevo, los turnos nuevos quedan con `price = 0` (no afecta al código viejo, que calcula con la cancha).
- [x] 1.3 Backfills: `sport_prices` desde las canchas (precio y seña de la cancha activa más cara por deporte, profe = público), `reservations.price` con el valor que tenían y una persona (posición 1) por turno existente; verificar en local que los valores de Hoy y Caja no cambian
  - Verificado: el valor de cada turno después del backfill es idéntico al cálculo anterior (diff vacío); precios por deporte desde las canchas (tenis $10.000 con seña 30 %, pádel $12.000; profe = público); una persona por turno; color asignado al profesor existente.
- [x] 1.4 `create_club` crea las filas de `sport_prices` de los deportes elegidos; función `ensure_series_until(p_club_id, p_until)` idempotente que materializa fechas faltantes salteando superposiciones; verificar desde SQL que dos llamadas seguidas no duplican fechas
  - `ensure_series_until` devuelve las fechas salteadas. Verificado: fijo de los lunes 26/10–14/12 con el 9/11 ocupado → 7 turnos con 2 personas cada uno y el 9/11 informado; segunda llamada sin duplicados; alguien de otro club recibe "No sos miembro de este club".
- [x] 1.5 `supabase/rollback/0008_down.sql` y prueba subir → bajar → subir en local sin perder turnos
  - `supabase/rollback/0008_down.sql` (incluye `create_club` de 0007). Verificado: subir → bajar → subir con los mismos conteos de turnos, cobros, canchas y clubes.

## 2. Precios por deporte

- [x] 2.1 `lib/pricing.ts`: `quotePrice` (deporte, tipo, duración) y `depositFor` sobre el valor fijado; reemplazar `getSlotPrice`/`getDepositAmount` en cobros, cancelación, detalle, Hoy (`lib/daily-overview.ts`), Caja y buscador; verificar que un cambio de precio no altera turnos existentes
  - `lib/pricing.ts`: `quotePrice`, `hourlyPrice`, `depositFor`, `pricesBySport`, `sportPricesSchema`; `hooks/use-sport-prices.ts`. Cobros, cancelación, aplicar saldo, detalle, Hoy (`amountDue` sin cancha) y Políticas usan `reservation.price`; formulario y buscador cotizan con `quotePrice`. Alta fija el valor; edición lo recalcula si cambia la cancha. Verificado en local: con tenis subido a $11.000 el turno existente sigue en $10.000, el nuevo queda en $11.000 y la seña 30 % cobra $3.300.
- [x] 2.2 Sección "Precios" en Canchas (una tarjeta por deporte del club: público, profe y seña, RHF + Zod, solo admin, auditoría `prices.updated`) y formulario de cancha sin precio ni seña (alta de cancha de un deporte nuevo crea su fila de precios); verificar los escenarios de `sport-pricing`
  - `components/courts/sport-prices-section.tsx` (una tarjeta por deporte del club con resumen en vivo) + `updateSportPricesAction` (auditoría `prices.updated`); formulario y tarjetas de cancha sin precio ni seña propios; crear una cancha de un deporte nuevo crea su fila de precios. Verificado: tarjetas de tenis y pádel, guardado, fútbol aparece al crear su primera cancha, Actividad registra el cambio.
- [x] 2.3 Políticas: sección "Torneos" con la duración estándar (pasos de 30); verificar que solo el admin la cambia y que el ejemplo de cancelación usa los precios por deporte
  - Sección "Torneos" en Políticas (60 min a 3 h) en el mismo formulario; el ejemplo de cancelación usa los precios por deporte. Verificado: el admin guarda 2 h (120 en la base) y el operador no accede a Políticas.

## 3. Socios

- [x] 3.1 Pantalla Socios real: listado con búsqueda (nombre, DNI, teléfono), "Agregar socio", editar y dar de baja (diálogos RHF + Zod), sin cuota, visible para admin y operador; acciones con auditoría `socio.created/updated/removed`; verificar los escenarios de `club-socios` (incluido DNI repetido y profesor sin acceso)
  - `lib/socios.ts` (schema compartido, DNI normalizado sin puntos), `app/dashboard/socios/actions.ts` (alta, edición y baja lógica, `requireRole("operador")`, auditoría) y `components/socios/socio-dialog.tsx`. El menú pasó de `adminOnly` a `minRole` (Socios visible para operador). Verificado en local: estado vacío, alta de 3 socios, DNI con puntos guardado sin puntos, DNI repetido rechazado, búsqueda por DNI, edición del correo; el profesor no ve Socios en el menú ni puede gestionarlos.
- [x] 3.2 Agregar el componente `command` de shadcn con el CLI y crear `PeopleCombobox` (sugerencias de socios por nombre o DNI, Enter fija persona no socia, chips quitables, máximo configurable); verificar con teclado y a 390 px
  - `command` agregado con el CLI de shadcn (sin pisar `dialog.tsx`) y `components/reservations/people-combobox.tsx`. Arreglo durante la prueba: al llegar las sugerencias la opción resaltada quedaba en "agregar sin ser socio" y Enter fijaba el texto; ahora resalta el primer socio. Verificado con teclado (Enter fija socio y persona no socia), chips quitables, y en el formulario a 390 px.

## 4. Tipos de turno y personas

- [x] 4.1 Formulario del turno: tipo (Estándar / Profe / Torneo; el profesor no elige), profe (staff), personas con `PeopleCombobox` (1–4; torneo mínimo 2), teléfono desde quien reserva, duración editable solo en torneo y valor según `quotePrice`; schema Zod en el formulario; verificar validaciones en español
  - Formulario reescrito: tipo (segmentado, oculto para el profesor), profe (con su color), duración solo en torneo (de 30 min hasta el cierre, arranca en la estándar), personas con `PeopleCombobox` (en profe: alumnos opcionales), teléfono tomado de la ficha del socio y valor/seña según tipo y duración. Verificado: errores "Indicá quién reserva el turno", "Elegí qué profe usa la cancha" y "Un torneo necesita al menos 2 jugadores".
- [x] 4.2 Server Actions de alta y edición: validan tipo, profe del club, personas y duración; fijan `price`; guardan personas (con compensación si fallan); auditoría con tipo y personas; verificar los escenarios de `reservation-types` (profe forzado, profe sin elegir, torneo de 1 persona, torneo de 90 y 120 min, superposición)
  - `prepareReservation` (común a alta y edición) + `saveParticipants`; el turno se devuelve con sus personas (`RESERVATION_SELECT`). Verificado en la base: estándar $11.000 con 2 personas (socio + no socio); profe cargado por el operador a $8.000 a nombre de Espe Rando; torneo de 90 min a $16.500; superposición con el torneo rechazada; el profe con su cuenta crea un turno de profe a su nombre sin alumnos.
- [ ] 4.3 Color de profe: `lib/profe-colors.ts`, asignación automática al sumarse o pasar a profesor, selector en Equipo (solo admin); verificar que el color nuevo se ve en la planilla
- [ ] 4.4 Distinción visual (`kindStyle`) en grilla, planilla del celular, Hoy y detalle, y leyenda de tipos; revisar contraste y verificar el escenario de la planilla con tipos mezclados a 1440 y 390 px

## 5. Turnos fijos

- [ ] 5.1 Opción "Repetir todas las semanas" en el alta (estándar y profe): crea la serie, materializa 8 semanas y muestra las fechas salteadas; verificar el escenario de semana ocupada
- [ ] 5.2 Planilla, Hoy y buscador llaman a `ensure_series_until` con la fecha mostrada; verificar que un fijo aparece al navegar seis meses adelante
- [ ] 5.3 Detalle del turno fijo: ícono y texto "Fijo · todos los lunes 09:00", "Dar de baja desde esta fecha" (staff y profe dueño) que libera fechas sin cobros y lista las que tienen cobros; auditoría `series.created/ended`; verificar los escenarios de baja y de fecha con cobro, y que cancelar una fecha suelta no afecta las demás

## 6. Cierre

- [ ] 6.1 Recorrido completo en local: precios de tenis y pádel, socios, turno estándar con socio, turno de profe cargado por el operador y por el profe, torneo singles y dobles con duración cambiada, fijo con baja, cobro y cancelación de cada tipo, Caja y Actividad
- [x] 6.2 Aplicar `0008` en producción con confirmación del usuario y repetir conteos
  - Aplicada 2026-10-12 antes de la fase 2, con confirmación del usuario, para que su `localhost:3000` (base real) siga funcionando mientras se desarrolla (la migración es aditiva). Verificado: los 24 turnos conservan su valor (`price` = precio de la cancha × duración en todos), 24 personas, precios por deporte desde las canchas. Hay un club nuevo de prueba del usuario (`0a3a89e7…`) con precios en $0.
- [ ] 6.3 Actualizar README, `docs/PROJECT_DOCUMENTATION.md` y marcar en `docs/next-steps.md` los puntos aplicados; marcar `add-fixed-reservations` como absorbido por este cambio
