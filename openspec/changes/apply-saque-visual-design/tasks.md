# Tasks — apply-saque-visual-design

> **Estado (2026-10-06):** fase 1 (base visual) terminada. Siguiente: fase 2 (shell del panel). Club de prueba creado en Supabase (admin `saque.admin.prueba@example.com` y operador `saque.operador.prueba@example.com`, contraseñas en `.env.local` como `TEST_*`, que no se versiona) para las recorridas con Playwright. Referencia visual: canvas https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF (releer el artboard de cada fase antes de empezarla).
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

- [ ] 2.1 Crear `components/shell/nav-config.ts` con grupos Operación/Club/Administración, rutas existentes, rótulos nuevos (Hoy, Planilla, Equipo, Políticas), íconos lucide y `adminOnly` (incluye Actividad), y verificar que cada `href` apunta a una ruta existente o a `/dashboard/actividad`
- [ ] 2.2 Crear `components/shell/app-sidebar.tsx` (oscuro, logo, bloque del club con rol, grupos, ítem activo pelota con `aria-current="page"`, usuario + "Cerrar sesión") y verificar a 1440 px que el ítem activo cambia al navegar
- [ ] 2.3 Crear `components/shell/mobile-tab-bar.tsx` (Hoy, Planilla, Buscar → `/dashboard/reservas?buscar=1`, Caja, Más → `Sheet` con el resto de ítems permitidos, club y cerrar sesión; objetivos ≥ 44 px) y verificar a 390 px que la barra no tapa contenido
- [ ] 2.4 Reescribir `app/dashboard/layout.tsx` para componer sidebar/tab bar según ancho manteniendo `AuthGuard` y la lógica de rol, y verificar con un usuario operador que no ve ítems solo-admin
- [ ] 2.5 Crear `components/shell/page-header.tsx` y aplicarlo a todas las páginas del panel (incluidas Socios, Productos, Caja, Reportes, Notificaciones, Suscripción), y verificar que todos los títulos usan la fuente display

## 3. Acceso: login, registro y verificación

- [ ] 3.1 Releer artboards Main y Registro; crear `components/auth/auth-layout.tsx` (panel de marca con `CourtLines` + slot del formulario, reducido en celular) y `components/auth/password-input.tsx` (toggle con `aria-label` dinámico), y verificar que el formulario entra sin scroll a 390 × 844
- [ ] 3.2 Rehacer `app/login/page.tsx` con `AuthLayout`, migrado a RHF + Zod (mensajes en español), alerta de error con `role="alert"` y botón "Ingresando…", y verificar login correcto, login con contraseña mala y redirección a `/dashboard`
- [ ] 3.3 Rehacer `app/register/page.tsx` con `AuthLayout` conservando schema, campos y flujo actual, errores por campo, y verificar que un registro nuevo llega a la verificación
- [ ] 3.4 Rehacer `app/verification-account/page.tsx` con la misma identidad conservando reenvío y límites, y verificar el flujo de reenvío (respetando el límite de 2 emails/hora del SMTP por defecto)

## 4. Hoy (inicio)

- [ ] 4.1 Crear `lib/daily-overview.ts` (`computeDaySummary`, `courtStatusNow`, `upcomingReservations`, `freeGaps`) y verificar con un caso armado a mano (3 turnos, uno pagado $24.000, uno señado $7.200) que cobrado = $31.200 y por cobrar = saldo correcto
- [ ] 4.2 Crear `hooks/use-day-payments.ts` (pagos no liberados de las reservas del día) y verificar que devuelve los cobros registrados desde la planilla
- [ ] 4.3 Agregar `buildAvailabilityMessage` a `lib/availability.ts` y verificar que arma el texto con saludo, lista y "¿Te reservo alguno?"
- [ ] 4.4 Releer artboard Hoy y rehacer `app/dashboard/page.tsx`: resumen (ocultar montos para profesor), "Ahora en cancha" con tonos y filtro por deporte, próximos turnos con "Cobrar $X" que abre el detalle, huecos libres + "Copiar para WhatsApp" con toast; estado vacío sin canchas. Verificar contra datos reales a 1440 px y 390 px

## 5. Planilla: refactor previo (sin cambios visuales)

- [ ] 5.1 Extraer de `components/reservations/reservation-dialog.tsx` el hook `useReservationDetail` (carga de pagos, auditoría, settings, saldo; acciones de cobro y cancelación) sin cambiar la UI, y verificar manualmente: crear turno, registrar seña, registrar total, cancelar en término, cancelar tardía, profesor bloqueado dentro de la ventana
- [ ] 5.2 Separar el alta/edición en `ReservationFormDialog` y el detalle en `ReservationDetailPanel` (todavía dentro del diálogo actual), y repetir la verificación de 5.1

## 6. Planilla: escritorio

- [ ] 6.1 Releer artboard Planilla; crear `hooks/use-now.ts` y la grilla CSS de `components/reservations/schedule-grid.tsx` (columnas por cancha, filas de 30 min, bloques por duración con `toneClasses`, franjas libres/fuera de horario, `aria-label` completos, línea de "ahora" solo para hoy), y verificar que un turno de 90 min se ve como un bloque y que tocar una franja libre abre el alta precargada
- [ ] 6.2 Rehacer el encabezado de `app/dashboard/reservas/page.tsx` (navegación de día, "HOY", filtro por deporte con `toggle-group`, "¿Hay cancha?", "Nuevo turno", leyenda de estados) y verificar que cambiar de día y de filtro actualiza la grilla
- [ ] 6.3 Mostrar `ReservationDetailPanel` como `<aside>` lateral en escritorio con el turno seleccionado resaltado (selector de estado de pago, cobrar, editar, cancelar con resultado de la política, historial), y verificar que todas las acciones de 5.1 funcionan desde el panel
- [ ] 6.4 Abrir el buscador cuando la URL trae `?buscar=1` y verificar desde la barra inferior del celular

## 7. Planilla: celular y buscador

- [ ] 7.1 Releer artboard MobilePlanilla; rehacer la vista < lg: tira de días, selector de cancha, lista desde cerca de la hora actual con "Ver desde las HH:MM", huecos pasados como "Sin uso", línea de ahora y botón flotante "Nuevo turno", y verificar a 390 px
- [ ] 7.2 Mostrar el detalle en `Sheet side="bottom"` en celular; releer artboard MobileCancelar y rediseñar el paso de cancelación (resumen del turno, resultado de la política en $ y motivo), y verificar cancelación en término y tardía desde el celular
- [ ] 7.3 Releer artboard MobileBuscar y rediseñar `availability-search-dialog.tsx` como "¿Hay cancha?" (día, deporte, desde; resultados con "Reservar"; vista previa del texto; "Copiar disponibilidad"), pantalla completa en celular, y verificar el caso sin resultados y la copia al portapapeles

## 8. Administración

- [ ] 8.1 Releer artboard Canchas y rehacer `app/dashboard/canchas/page.tsx` + `components/courts/*` (tarjetas, formulario con segmentado de duración, switch de seña y resumen en vivo con `getSlotPrice`/`getDepositAmount`), y verificar crear, editar y dar de baja
- [ ] 8.2 Agregar `ROLE_CAPABILITIES` en `lib/roles.ts`, releer artboard Equipo y rehacer `app/dashboard/miembros/page.tsx` (tabla de personas, chips de rol, menú de opciones, matriz de permisos), y verificar invitar, cambiar rol y quitar
- [ ] 8.3 Releer artboard Políticas y rehacer `app/dashboard/configuracion/page.tsx` (línea de tiempo, opciones de anticipación y penalidad sobre el form RHF + Zod existente, ejemplo recalculado en vivo con una cancha real o valor de referencia rotulado), y verificar que guarda y que el ejemplo coincide con lo que hace la cancelación

## 9. Actividad (página nueva)

- [ ] 9.1 Agregar `describeAuditEntry` en `lib/audit.ts` (frase en español por `AuditAction`, con respaldo genérico) y verificar con entradas reales de cada tipo
- [ ] 9.2 Crear `app/dashboard/actividad/page.tsx` como Server Component (chequeo admin en servidor, lectura de `audit_log` + nombres + reservas/canchas referenciadas, agrupado por día, cursor "Cargar más") con filtros por persona y tipo en un client component sobre `searchParams`, y verificar como admin (ve el log) y como operador (ve el aviso)

## 10. Cierre

- [ ] 10.1 Recorrida completa a 1440 px y 390 px de todas las rutas comparando contra el canvas, con teclado (foco visible, orden de tabulación) y contraste de estados; anotar diferencias aceptadas acá
- [ ] 10.2 Actualizar `docs/PROJECT_DOCUMENTATION.md` (identidad visual, dónde están tokens/marca/tonos, rótulos nuevos de navegación, fuera de alcance pendiente) y verificar que el estado de este archivo refleja lo hecho
- [ ] 10.3 Registrar como cambios OpenSpec separados (sin implementar) los pendientes de diseño: alta del club, turnos fijos, superficie de cancha, "cancela el club", devolución de seña, alerta de fijos, portal público, y verificar que aparecen en `openspec list`
