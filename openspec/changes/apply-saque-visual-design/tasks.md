# Tasks — apply-saque-visual-design

> **Estado (2026-10-06):** fases 1 a 9 terminadas (base visual, shell, acceso, Hoy, refactor del diálogo, planilla de escritorio + arreglo del cobro total, planilla en celular + buscador, Canchas/Equipo/Políticas, Actividad). Siguiente: fase 10 (cierre: recorrida completa, documentación y pendientes). Club de prueba creado en Supabase (admin `saque.admin.prueba@example.com` y operador `saque.operador.prueba@example.com`, contraseñas en `.env.local` como `TEST_*`, que no se versiona) para las recorridas con Playwright. Referencia visual: canvas https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF (releer el artboard de cada fase antes de empezarla).
>
> **Cómo se trabaja:** una fase por vez. Al cerrar cada fase: `pnpm exec tsc --noEmit` + `pnpm build` sin errores, recorrida visual a 1440 px y 390 px con Playwright CLI, actualizar este estado y commit propio de la fase.

## 1. Base visual: tokens, fuentes y marca

- [x] 1.1 Reescribir los tokens de `app/globals.css` con la paleta saque según design.md §1 (variables shadcn + `--ball`, `--line`, `--ink`, `--success`, `--sidebar*` expuestas en `@theme`, utilidad `.bg-hatch`), y verificar que `bg-ball`, `text-line` y `bg-sidebar` generan CSS en `pnpm build`
- [x] 1.2 Cargar Archivo (eje `wdth`), Geist y Geist Mono con `next/font/google` en `app/layout.tsx` como `--font-display`/`--font-sans`/`--font-mono` y mapearlas en `@theme`, y verificar en el navegador que el body usa Geist y un título con `font-display font-stretch-expanded` se ve expandido
  - Verificado: body en Geist, título display en Archivo con `font-stretch: 125%`. La utilidad `font-mono` se genera recién cuando una pantalla la usa (se confirma en fase 2/4).
- [x] 1.3 Crear `lib/brand.ts` (`PRODUCT_NAME`), `components/brand/logo.tsx` (marca "T" + wordmark, variantes sobre fondo claro/oscuro) y `components/brand/court-lines.tsx` (dibujo `aria-hidden`); usar `metadata.title` con plantilla `%s · saque`, y verificar que la pestaña del navegador muestra el nombre
- [x] 1.4 Crear `lib/reservation-tone.ts` (tonos paid/deposit/pending/cancelled/fixed + `toneFor(reservation)` + `toneClasses(tone)`) y agregar esas variantes al `cva` de `components/ui/badge.tsx`, y verificar que compila con `pnpm exec tsc --noEmit`
- [x] 1.5 Ajustar `button`, `input`, `card` y `badge` de `components/ui/` al sistema (radio 10 px, alto 44 px en inputs/botones, foco color línea, botón principal tinta) sin cambiar su API, y verificar que login, reservas y canchas siguen funcionando sin errores de consola
- [x] 1.6 Agregar `toggle-group` y `scroll-area` con `pnpm dlx shadcn@latest add`, revisar que usan los tokens del proyecto, y verificar que el build pasa
- [x] 1.7 Recorrida de cierre de fase: abrir todas las rutas existentes (incluidas las mock) a 1440 px y 390 px y anotar acá cualquier regresión visual por el cambio de tokens; corregir las que rompan legibilidad
  - Recorrida 2026-10-06 (admin de prueba, 1440 y 390 px): todas las rutas legibles con los tokens nuevos, sin errores de consola. Detalle visto: el email largo del usuario desborda el pie del menú lateral en escritorio (preexistente, se resuelve en 2.2).

## 2. Shell del panel

- [x] 2.1 Crear `components/shell/nav-config.ts` con grupos Operación/Club/Administración, rutas existentes, rótulos nuevos (Hoy, Planilla, Equipo, Políticas), íconos lucide y `adminOnly` (incluye Actividad), y verificar que cada `href` apunta a una ruta existente o a `/dashboard/actividad`
- [x] 2.2 Crear `components/shell/app-sidebar.tsx` (oscuro, logo, bloque del club con rol, grupos, ítem activo pelota con `aria-current="page"`, usuario + "Cerrar sesión") y verificar a 1440 px que el ítem activo cambia al navegar
- [x] 2.3 Crear `components/shell/mobile-tab-bar.tsx` (Hoy, Planilla, Buscar → `/dashboard/reservas?buscar=1`, Caja, Más → `Sheet` con el resto de ítems permitidos, club y cerrar sesión; objetivos ≥ 44 px) y verificar a 390 px que la barra no tapa contenido
- [x] 2.4 Reescribir `app/dashboard/layout.tsx` para componer sidebar/tab bar según ancho manteniendo `AuthGuard` y la lógica de rol, y verificar con un usuario operador que no ve ítems solo-admin
- [x] 2.5 Crear `components/shell/page-header.tsx` y aplicarlo a todas las páginas del panel (incluidas Socios, Productos, Caja, Reportes, Notificaciones, Suscripción), y verificar que todos los títulos usan la fuente display
  - Verificado 2026-10-06: admin ve los 3 grupos; operador solo Hoy/Planilla (sin Caja en la barra inferior). "Buscar" de la barra apunta a `?buscar=1`, que se conecta en 6.4. Geist Mono confirmada en el eyebrow de Hoy.

## 3. Acceso: login, registro y verificación

- [x] 3.1 Releer artboards Main y Registro; crear `components/auth/auth-layout.tsx` (panel de marca con `CourtLines` + slot del formulario, reducido en celular) y `components/auth/password-input.tsx` (toggle con `aria-label` dinámico), y verificar que el formulario entra sin scroll a 390 × 844
- [x] 3.2 Rehacer `app/login/page.tsx` con `AuthLayout`, migrado a RHF + Zod (mensajes en español), alerta de error con `role="alert"` y botón "Ingresando…", y verificar login correcto, login con contraseña mala y redirección a `/dashboard`
- [x] 3.3 Rehacer `app/register/page.tsx` con `AuthLayout` conservando schema, campos y flujo actual, errores por campo, y verificar que un registro nuevo llega a la verificación
- [x] 3.4 Rehacer `app/verification-account/page.tsx` con la misma identidad conservando reenvío y límites, y verificar el flujo de reenvío (respetando el límite de 2 emails/hora del SMTP por defecto)
  - Verificado 2026-10-06 con Playwright (1440 y 390 px): errores Zod en español, toggle de contraseña con aria-label dinámico, alerta "El email o la contraseña no coinciden…" (role=alert) conservando el email, login correcto → `/dashboard`, registro con errores por campo y botón visible sin scroll a 390 × 844, verificación sin `?code` → estado de error. **No se ejercitó el reenvío real** para no gastar el cupo de 2 emails/hora del SMTP por defecto (la lógica de `signUp`/`resend` quedó idéntica).

## 4. Hoy (inicio)

- [x] 4.1 Crear `lib/daily-overview.ts` (`computeDaySummary`, `courtStatusNow`, `upcomingReservations`, `freeGaps`) y verificar con un caso armado a mano (3 turnos, uno pagado $24.000, uno señado $7.200) que cobrado = $31.200 y por cobrar = saldo correcto
- [x] 4.2 Crear `hooks/use-day-payments.ts` (pagos no liberados de las reservas del día) y verificar que devuelve los cobros registrados desde la planilla
- [x] 4.3 Agregar `buildAvailabilityMessage` a `lib/availability.ts` y verificar que arma el texto con saludo, lista y "¿Te reservo alguno?"
- [x] 4.4 Releer artboard Hoy y rehacer `app/dashboard/page.tsx`: resumen (ocultar montos para profesor), "Ahora en cancha" con tonos y filtro por deporte, próximos turnos con "Cobrar $X" que abre el detalle, huecos libres + "Copiar para WhatsApp" con toast; estado vacío sin canchas. Verificar contra datos reales a 1440 px y 390 px
  - Verificado 2026-10-06 con reloj simulado a las 18:40 (Playwright): resumen con datos sembrados (17 turnos, cobrado $229.600, por cobrar $242.400), Ahora en cancha con tonos, "Cobrar $16.800" abre el diálogo de la reserva, copia al portapapeles + toast "Copiado". En celular la tabla de próximos turnos pasa a filas apiladas.
  - Arreglos colaterales: `* { border-color }` y `body` de `globals.css` estaban fuera de `@layer base` y pisaban todas las utilidades de color de borde (ej. `border-ink`); `useReservations`/`useCourts` no limpiaban el error tras una carga exitosa.

## 5. Planilla: refactor previo (sin cambios visuales)

- [x] 5.1 Extraer de `components/reservations/reservation-dialog.tsx` el hook `useReservationDetail` (carga de pagos, auditoría, settings, saldo; acciones de cobro y cancelación) sin cambiar la UI, y verificar manualmente: crear turno, registrar seña, registrar total, cancelar en término, cancelar tardía, profesor bloqueado dentro de la ventana
- [x] 5.2 Separar el alta/edición en `ReservationFormDialog` y el detalle en `ReservationDetailPanel` (todavía dentro del diálogo actual), y repetir la verificación de 5.1
  - Hecho junto con 5.1: `hooks/use-reservation-detail.ts` (lógica), `components/reservations/reservation-form.tsx` (alta/edición) y `reservation-detail-panel.tsx` (cobros, cancelación, historial); `ReservationDialog` conserva sus props. Verificado 2026-10-06 con Playwright + lectura de la base: crear, seña, total, cancelación en término (todo a saldo a favor), cancelación tardía sin cobros (deuda $12.000) y profesor bloqueado dentro de la ventana (rol cambiado temporalmente y restaurado). Arreglo colateral: el formulario arrancaba vacío al montarse dentro del diálogo; ahora se inicializa con los valores al montar.
  - **Bug preexistente detectado (no visual):** "Cobrar total" registraba el precio completo aunque ya hubiera seña cobrada. El usuario pidió arreglarlo ahora → tarea 6.5.

## 6. Planilla: escritorio

- [x] 6.1 Releer artboard Planilla; crear `hooks/use-now.ts` y la grilla CSS de `components/reservations/schedule-grid.tsx` (columnas por cancha, filas de 30 min, bloques por duración con `toneClasses`, franjas libres/fuera de horario, `aria-label` completos, línea de "ahora" solo para hoy), y verificar que un turno de 90 min se ve como un bloque y que tocar una franja libre abre el alta precargada
- [x] 6.2 Rehacer el encabezado de `app/dashboard/reservas/page.tsx` (navegación de día, "HOY", filtro por deporte con `toggle-group`, "¿Hay cancha?", "Nuevo turno", leyenda de estados) y verificar que cambiar de día y de filtro actualiza la grilla
- [x] 6.3 Mostrar `ReservationDetailPanel` como `<aside>` lateral en escritorio con el turno seleccionado resaltado (selector de estado de pago, cobrar, editar, cancelar con resultado de la política, historial), y verificar que todas las acciones de 5.1 funcionan desde el panel
- [x] 6.4 Abrir el buscador cuando la URL trae `?buscar=1` y verificar desde la barra inferior del celular
  - Verificado 2026-10-06 (Playwright + base): grilla CSS con bloques por duración (pádel 90 min = 3 filas), línea de ahora solo en hoy, franja libre → alta precargada (Cancha 3 · 10:00), navegación de días + "Volver a hoy", panel lateral con seña / saldo / editar (diálogo sin detalle) / cancelación en término (saldo a favor $24.000) y tardía (deuda $12.000) mostrando el resultado en $ antes de confirmar. "Buscar" de la barra inferior abre el buscador y limpia `?buscar=1`.
  - Decisiones: el selector Pendiente/Señada/Pagada del canvas se implementó como acciones de cobro (método + "Cobrar saldo/total" + "Cobrar solo la seña"), porque el estado de pago lo derivan los cobros registrados; los turnos cancelados no se dibujan en la grilla para no tapar la franja que liberan. Arreglo colateral: `AlertDialogAction` ignoraba `className` con colores (asChild) → ahora usa `variant="destructive"` (planilla, canchas, equipo).
- [x] 6.5 (Agregada 2026-10-06, a pedido del usuario) Arreglar "Cobrar total": `registerPaymentAction` cobra solo el saldo (precio − cobrado no liberado) y el botón dice "Cobrar saldo $X" cuando ya hay cobros; verificar que seña + total suman exactamente el valor del turno
  - Verificado 2026-10-06: seña $7.200 + total $16.800 = $24.000; la cancelación en término libera $24.000 a saldo a favor.

## 7. Planilla: celular y buscador

- [x] 7.1 Releer artboard MobilePlanilla; rehacer la vista < lg: tira de días, selector de cancha, lista desde cerca de la hora actual con "Ver desde las HH:MM", huecos pasados como "Sin uso", línea de ahora y botón flotante "Nuevo turno", y verificar a 390 px
- [x] 7.2 Mostrar el detalle en `Sheet side="bottom"` en celular; releer artboard MobileCancelar y rediseñar el paso de cancelación (resumen del turno, resultado de la política en $ y motivo), y verificar cancelación en término y tardía desde el celular
- [x] 7.3 Releer artboard MobileBuscar y rediseñar `availability-search-dialog.tsx` como "¿Hay cancha?" (día, deporte, desde; resultados con "Reservar"; vista previa del texto; "Copiar disponibilidad"), pantalla completa en celular, y verificar el caso sin resultados y la copia al portapapeles
  - Verificado 2026-10-06 a 390 px (Playwright + base): tira de días, chips de cancha, lista desde una hora antes de ahora con "Ver desde las 08:00", huecos pasados "Sin uso", línea de ahora, botón flotante; hoja inferior con el detalle; cancelación en término (sin movimientos) y tardía (deuda $12.000) desde el celular; buscador con día/deporte/desde (pádel desde 21:00 → 1 lugar), vista previa y copia para WhatsApp, "Reservar" abre el alta precargada. Arreglos: el último hueco quedaba tapado por el botón flotante (espacio inferior); el buscador contaba como ocupados los turnos cancelados de otros días (ahora filtra `status=active`). Fuera de alcance del canvas MobileCancelar: "¿Quién cancela?" (cambio posterior).

## 8. Administración

- [x] 8.1 Releer artboard Canchas y rehacer `app/dashboard/canchas/page.tsx` + `components/courts/*` (tarjetas, formulario con segmentado de duración, switch de seña y resumen en vivo con `getSlotPrice`/`getDepositAmount`), y verificar crear, editar y dar de baja
- [x] 8.2 Agregar `ROLE_CAPABILITIES` en `lib/roles.ts`, releer artboard Equipo y rehacer `app/dashboard/miembros/page.tsx` (tabla de personas, chips de rol, menú de opciones, matriz de permisos), y verificar invitar, cambiar rol y quitar
- [x] 8.3 Releer artboard Políticas y rehacer `app/dashboard/configuracion/page.tsx` (línea de tiempo, opciones de anticipación y penalidad sobre el form RHF + Zod existente, ejemplo recalculado en vivo con una cancha real o valor de referencia rotulado), y verificar que guarda y que el ejemplo coincide con lo que hace la cancelación
  - Verificado 2026-10-06 (Playwright + base): Canchas → crear (pádel 90 min, 30%: resumen $36.000 · seña $10.800), editar (precio $30.000 → $45.000 · $13.500), dar de baja. Equipo → matriz desde `ROLE_CAPABILITIES` (corregida contra las Server Actions: el profesor sí crea/mueve cualquier turno y cancela en término solo sin cobros), cambio de rol y validación de invitación. Políticas → "Guardar" solo con cambios, ejemplo en vivo con Cancha 1 (50%: retiene $7.200 · debe $4.800; 25%: retiene $6.000 · $1.200 a favor), guarda y persiste tras recargar.
  - Arreglo colateral: el detalle del turno no mostraba la deuda adicional de una cancelación tardía con seña (el servidor retiene la seña **y** registra la diferencia hasta la penalidad). Ahora `lib/cancellation.ts` replica el cálculo del servidor y lo usan el detalle y Políticas; verificado contra la base (seña $7.200 retenida + deuda $4.800). También: `Switch` con estilo de marca, textos "Dar de baja" en canchas.

## 9. Actividad (página nueva)

- [x] 9.1 Agregar `describeAuditEntry` en `lib/audit.ts` (frase en español por `AuditAction`, con respaldo genérico) y verificar con entradas reales de cada tipo
- [x] 9.2 Crear `app/dashboard/actividad/page.tsx` como Server Component (chequeo admin en servidor, lectura de `audit_log` + nombres + reservas/canchas referenciadas, agrupado por día, cursor "Cargar más") con filtros por persona y tipo en un client component sobre `searchParams`, y verificar como admin (ve el log) y como operador (ve el aviso)
  - Verificado 2026-10-06: admin ve 39 entradas agrupadas por día con frases en español (cobros, cancelaciones con retención/deuda, cambios de rol con nombre, políticas, canchas); filtro "Cobró" → solo cobros; parámetros inválidos se ignoran (Zod); cursor `antes` devuelve las 29 posteriores a la 10ª + "Volver a lo más reciente"; operador ve el aviso. El historial del detalle del turno también usa `describeAuditEntry`. Nota: las entradas de turnos borrados a mano en la base (pruebas) no muestran nombre; con datos reales los turnos nunca se borran (soft delete).

## 10. Cierre

- [ ] 10.1 Recorrida completa a 1440 px y 390 px de todas las rutas comparando contra el canvas, con teclado (foco visible, orden de tabulación) y contraste de estados; anotar diferencias aceptadas acá
- [ ] 10.2 Actualizar `docs/PROJECT_DOCUMENTATION.md` (identidad visual, dónde están tokens/marca/tonos, rótulos nuevos de navegación, fuera de alcance pendiente) y verificar que el estado de este archivo refleja lo hecho
- [ ] 10.3 Registrar como cambios OpenSpec separados (sin implementar) los pendientes de diseño: alta del club, turnos fijos, superficie de cancha, "cancela el club", devolución de seña, alerta de fijos, portal público, y verificar que aparecen en `openspec list`
