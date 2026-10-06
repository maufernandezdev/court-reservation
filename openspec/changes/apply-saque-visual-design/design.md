## Context

- El diseño de referencia vive en el canvas https://claude.ai/artifact/HzX1cWWmfHrkUH27QnMidF (13 artboards `.dc.html`). Antes de implementar cada sección se relee el artboard correspondiente (el usuario puede haberlo editado): Sistema, Main (login), Registro, Hoy, Planilla, Canchas, Equipo, Políticas, Actividad, MobilePlanilla, MobileBuscar y MobileCancelar. AltaClub queda fuera de alcance (ver proposal).
- El canvas es HTML con estilos inline y datos de ejemplo. No se copia: se reconstruye con Tailwind v4 + shadcn/ui, siguiendo `AGENTS.md` y `docs/architecture-guidelines.md`.
- El tema actual es el neutro de shadcn en `app/globals.css` (variables HSL `--primary`, `--accent`, etc. mapeadas en `@theme inline`). No hay fuentes cargadas.
- La capa de datos del panel son hooks de cliente (`useCourts`, `useReservations`, `useMembership`) con el cliente de Supabase del navegador, más Server Actions en `app/dashboard/*/actions.ts`. `ReservationDialog` (827 líneas) concentra el alta, la edición, los cobros, la cancelación y el historial del turno.
- Next.js 16.3 (leer `node_modules/next/dist/docs/` antes de usar APIs nuevas). Archivo (con eje `wdth` 62–125), Geist y Geist Mono están disponibles en `next/font/google`.

## Goals / Non-Goals

**Goals:**
- Que cada fase deje la app funcionando y se pueda probar y commitear por separado.
- Reutilizar la lógica existente (pricing, availability, Server Actions, auditoría) sin duplicarla.
- Un único lugar para tokens, estilos de estado y navegación.

**Non-Goals:**
- Modo oscuro: el bloque `.dark` deja de mantenerse y no hay toggle.
- Cambios de esquema en Supabase o de reglas de negocio.
- Rediseño de las páginas mock (Socios, Productos, Caja, Reportes, Notificaciones, Suscripción): solo heredan tokens y reciben el encabezado común.
- Pasar los hooks de cliente existentes a Server Components. La excepción es Actividad, que es nueva.

## Decisions

### 1. Tokens: mapear la paleta sobre las variables de shadcn y sumar tokens de marca
`--background` = piso, `--foreground`/`--primary` = tinta, `--primary-foreground` = piso, `--card`/`--popover` = blanco, `--secondary`/`--muted` = `#ECEEE8`, `--muted-foreground` = `#5A6058`, `--border` = `#DFE2DA`, `--input` = `#CDD1C7`, `--ring` = línea, `--destructive` = `#C2361F`. **`--accent` queda como gris de hover** (`#ECEEE8`) porque shadcn lo usa para hover/focus de menús y selects. Si se usara para el amarillo pelota, todos los hovers de la app se pondrían amarillos. Por eso se agregan tokens propios: `--ball` (+ `--ball-foreground`), `--line`, `--ink`, `--success`, `--sidebar`, `--sidebar-foreground`, `--sidebar-muted`, expuestos en `@theme` como `bg-ball`, `text-line`, `bg-sidebar`, etc.
- Alternativa descartada: pasar a OKLCH como el shadcn más nuevo. Habría que reescribir el `@theme` y todos los componentes y no aporta nada para este cambio, así que se mantiene el formato HSL actual.

### 2. Fuentes con `next/font/google` y variables CSS
En `app/layout.tsx`: `Archivo({ axes: ["wdth"], variable: "--font-display" })`, `Geist({ variable: "--font-sans" })` y `Geist_Mono({ variable: "--font-mono" })`, aplicadas en `<html>`. En `@theme`: `--font-sans`, `--font-mono` y `--font-display`. Los títulos usan `font-display font-extrabold font-stretch-expanded` (o `font-stretch-[125%]`) con `tracking-tight`. Se usa `next/font` por la regla de arquitectura (evita CLS y no depende de un CDN en runtime).

### 3. Estados de turno: una sola fuente de verdad
`lib/reservation-tone.ts` exporta el tono de cada estado (`paid`, `deposit`, `pending`, `cancelled` y `fixed`, reservado) y lo resuelve a partir de una `Reservation` (`status` + `payment_status`). Se aplica de dos formas:
- `components/ui/badge.tsx` suma estas variantes en su `cva`, para usar el estado como etiqueta.
- La función `toneClasses(tone)` devuelve las clases de fondo, borde y texto para bloques y tarjetas (planilla, Hoy, celular).

El rayado de "cancelada" se define como utilidad en `globals.css` (`.bg-hatch`).

### 4. Marca centralizada
`lib/brand.ts` (`PRODUCT_NAME = "saque"`, tagline) más `components/brand/logo.tsx` (marca SVG inline + wordmark, con variantes según el fondo) y `components/brand/court-lines.tsx` (dibujo decorativo de la cancha, `aria-hidden`). La marca es SVG inline y no `<img>`, así que no choca con la regla de `next/image`. `metadata.title` usa la plantilla `%s · saque`. Mientras no exista una entidad club, el nombre del club sigue saliendo de `CLUB_NAME` en `lib/mocks/data.ts`.

### 5. Shell: configuración de navegación + dos presentaciones
`components/shell/nav-config.ts` define los grupos, ítems, rutas, íconos lucide y `adminOnly`. La configuración la consumen:
- `AppSidebar` (escritorio, ≥ lg): oscuro, bloque del club y usuario.
- `MobileTabBar` (< lg): barra inferior fija. "Más" abre un `Sheet` con el resto de los ítems.

`app/dashboard/layout.tsx` sigue siendo client component (depende de `useAuth`/`useMembership`) y solo compone. El `<main>` suma padding inferior en celular para no quedar tapado por la barra. "Buscar" de la barra navega a `/dashboard/reservas?buscar=1`, que abre el buscador.
- Alternativa descartada: el Sidebar block de shadcn. Trae mucha estructura (collapsible, rail, cookies) que este menú no necesita.

### 6. Encabezado de página común
`components/shell/page-header.tsx` (título display, descripción opcional, slot de acciones). Lo usan todas las páginas del panel, incluidas las mock, para que se vean parte del mismo producto con poco esfuerzo.

### 7. Cálculos de Hoy y de cobros como funciones puras
`lib/daily-overview.ts`: `computeDaySummary(courts, reservations, payments, now)`, `courtStatusNow(...)`, `upcomingReservations(...)` y `freeGaps(courts, reservations, from)`. Esto separa la lógica de la UI y permite verificarla con casos manuales.
- **Cobrado**: suma de los pagos no liberados de los turnos del día.
- **Por cobrar**: valor del turno (`getSlotPrice` con su duración) menos lo cobrado, en turnos activos no pagados.

Para tener los pagos del día se agrega el hook `useDayPayments(reservationIds)`: un `select` a `payments` filtrado por `reservation_id in (...)`, cubierto por las RLS `is_member` existentes. El rol profesor no ve los montos (Hoy oculta las tarjetas de dinero y los botones "Cobrar").

### 8. Texto para WhatsApp compartido
`lib/availability.ts` suma `buildAvailabilityMessage({ dayLabel, sportLabel, slots })`, que usan Hoy (huecos libres) y el buscador. La copia usa `navigator.clipboard.writeText` y confirma con un toast de `sonner`.

### 9. Planilla: grilla CSS en lugar de `<Table>`
La grilla de escritorio pasa de `<Table>` con celdas por franja a un CSS grid (`grid-template-columns: 4rem repeat(n, minmax(9rem,1fr))`, filas de 30 min). Cada turno es un `<button>` posicionado con `grid-row: start / span n` según `duration_minutes`. Eso resuelve "un bloque por turno", que con `<Table>` no se puede (la grilla actual pinta las continuaciones como celdas sueltas). Las franjas libres son botones de fondo en la misma grilla. La línea de "ahora" es un elemento posicionado en px a partir de los minutos desde la apertura, actualizado por `useNow(60_000)`.

### 10. Detalle del turno: separar lógica de presentación del diálogo
Se extrae de `ReservationDialog` el hook `useReservationDetail(reservation, membership)`, con la carga de pagos, auditoría, settings y saldo y las acciones de cobro y cancelación que llaman a las Server Actions existentes. Lo usan:
- `ReservationDetailPanel`, contenido de solo-lectura + acciones, con este layout:
  - **Escritorio:** `<aside>` a la derecha de la grilla.
  - **Celular:** `Sheet side="bottom"`.
- `ReservationFormDialog`, el alta y la edición de datos del turno (sigue con RHF + Zod), que queda como diálogo.

La refactorización se hace en dos pasos: primero se extrae sin cambiar la UI y se verifica, y recién después se rediseña.
- Alternativa descartada: rediseñar `ReservationDialog` en el lugar. Mezclar el refactor con el rediseño en un archivo de 800 líneas hace que una regresión en cobros o cancelaciones sea difícil de detectar.

### 11. Actividad como Server Component
`app/dashboard/actividad/page.tsx` es un Server Component con `lib/supabase/server`:
- Valida el rol admin en el servidor; si no es admin, muestra el aviso en lugar del log.
- Lee `audit_log` (con límite y cursor por `created_at` en `searchParams`) y `memberships` para los nombres.
- Para los textos, lee las reservas referenciadas (`entity_id`) y sus canchas.

`describeAuditEntry(entry, ctx)` en `lib/audit.ts` arma la frase en español para cada `AuditAction`, con un texto genérico de respaldo para payloads incompletos. Los filtros son un pequeño client component que escribe en `searchParams`. Al ser una página nueva, puede seguir server-first sin tocar los hooks existentes.

### 12. Permisos por rol declarados junto a los roles
La matriz de Equipo sale de `ROLE_CAPABILITIES` en `lib/roles.ts`, al lado de `roleAtLeast`, para que la explicación y las reglas no se desincronicen.

### 13. Login con RHF + Zod
Hoy el login usa `useState` sin Zod, contra la regla de `AGENTS.md`. Como se rehace la pantalla, se migra a `react-hook-form` + `zodResolver` con el mismo `PasswordInput` (que pasa a un componente compartido `components/auth/password-input.tsx` usado también por el registro).

### 14. Componentes shadcn nuevos
Se agregan con el CLI (`pnpm dlx shadcn@latest add toggle-group scroll-area`) para los controles segmentados (filtro por deporte, estado de pago, duración, anticipación) y las tiras horizontales del celular. Hay que revisar que el componente generado use los tokens del proyecto.

## Risks / Trade-offs

- [Regresión en cobros/cancelación al tocar `ReservationDialog`] → Decisión 10: refactor sin cambios visuales primero, con una verificación manual de crear, cobrar seña, cobrar total, cancelar en término y cancelar tardía antes de rediseñar.
- [Las variantes por defecto de shadcn (`default`, `secondary`, `outline`) cambian de color en toda la app al cambiar los tokens] → La fase 1 cierra con una recorrida de todas las rutas en escritorio y celular.
- [La grilla CSS pierde la semántica de tabla para lectores de pantalla] → Cada bloque y franja es un `<button>` con `aria-label` completo ("Sofía Navarro, 19:00 a 20:00, Señada" / "Cancha 3, 21:00, libre"), y las columnas se rotulan con el nombre de la cancha.
- [Hoy hace una consulta más (pagos)] → Una sola consulta `in (...)` por fecha; si crece, mover el resumen a una RPC en un cambio posterior.
- [Las fuentes expandidas no entran en columnas angostas] → Títulos con `text-balance` y tamaños menores en celular; la planilla usa la fuente de interfaz dentro de los bloques.
- [El canvas cambia mientras se implementa] → Releer el artboard al empezar cada fase; si contradice lo implementado, gana el canvas y se anota en tasks.

## Migration Plan

Todo es frontend, sin migraciones. Cada fase de `tasks.md` termina con: `pnpm exec tsc --noEmit`, `pnpm build`, la recorrida de las pantallas tocadas (Playwright CLI a 1440 px y 390 px, comparando contra el artboard) y un commit propio. Para volver atrás se revierte el commit de la fase. Las fases 1 a 3 cambian el aspecto de toda la app y conviene probarlas juntas antes de seguir.

## Open Questions

- Nombre definitivo del producto (hoy "saque"): se cambia en `lib/brand.ts` sin tocar el plan.
- Si "Caja" debe quedar en la barra inferior del celular mientras siga siendo una página mock, o reemplazarse por "Canchas".
