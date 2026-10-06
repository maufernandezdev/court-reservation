# Design — add-club-operations-foundation

## Context

Estado actual (ver gap analysis): `courts` y `reservations` con RLS por `user_id = auth.uid()` (modelo multi-club single-user), reservas de 1h fijas, sin dinero, sin roles, borrado físico, y planilla desktop con scroll horizontal. Supabase se migra a mano desde `supabase/migrations/` (sin CLI). Stack: Next.js App Router, shadcn/ui, RHF+Zod, pnpm, español voseo.

## Goals / Non-Goals

**Goals**
- Modelo de datos que soporte precios, duraciones, horarios, señas, roles, cancelaciones, auditoría y pagos manuales, quedando listo para MP (referencia externa en pagos) sin cambios estructurales después.
- Migración no destructiva: usuarios y datos existentes siguen funcionando; el dueño existente queda `admin`.
- Planilla operable 100% desde celular.

**Non-Goals**
- Integración Mercado Pago (iteración posterior; solo se preserva `external_ref` en `payments`).
- Portal público de reservas online.
- Turnos fijos/recurrentes y fichas de profesores (la restricción de borrado del profe sí entra; la recurrencia no).
- Módulos mock (caja, socios, productos, reportes) siguen con mocks; solo caja ligada a cobros reales de reservas queda fuera de alcance salvo el registro de pagos en la reserva.

## Decisions

### D1 — Tenancy por `owner_id` + `memberships`, no tabla `clubs`
Se conserva `user_id` en `courts`/`reservations` renombrado conceptualmente a `owner_id` (el dueño del club = tenant). Los miembros se modelan en `memberships (owner_id, user_id, role, full_name)`. RLS pasa de `user_id = auth.uid()` a `owner_id IN (SELECT owner_id FROM memberships WHERE user_id = auth.uid())`, envuelto en función `SECURITY DEFINER` `is_member(owner_id uuid)` para evitar subconsultas recursivas en RLS y mantener policies simples.
- **Alternativa considerada**: tabla `clubs` con `club_id` en todas las filas. Rechazada: obliga a tocar todas las migraciones/filas existentes y renombrar columnas; el membership resuelve el mismo problema con una sola tabla nueva.

### D2 — Un `memberships` cubre perfiles + roles
No hay tabla `profiles` separada: `memberships.role` (`admin`|`operador`|`profesor`) + `full_name` es el perfil dentro del club. Un mismo email puede ser profe en un club y operador en otro.
- **Alternativa**: `profiles` global con un rol por usuario. Rechazada: los roles son por club, no globales.

### D3 — Configuración de seña y precios en `courts`, políticas globales en `settings`
Seña por cancha (`deposit_enabled`, `deposit_type`, `deposit_value`) junto a `price_per_hour`, `slot_duration`, `open_time`, `close_time`: el SRS la pide "global o por tipo de usuario/horario"; se elige por cancha por simplicidad operativa. Ventana de cancelación y % de penalidad son del club → tabla `settings (owner_id PK, cancel_window_hours default 24, late_penalty_percent default 50)`.
- Validación Zod (no CHECK crudos que impidan defaults): `deposit_value > 0`, y en la app se valida que la seña calculada no supere el valor del turno (seña % del precio×duración).

### D4 — Cancelación lógica + partial unique index
`reservations` gana `status ('active'|'cancelled')`, `cancelled_at`, `cancelled_by`, `cancel_reason`, `late_cancel`. Se reemplaza `UNIQUE(court_id, date, time)` por índice único parcial `WHERE status = 'active'`, así el turno queda libre al cancelar pero el registro (y su auditoría) se conserva. El chequeo de solapamiento por duración variable se hace en la capa de datos (`lib/availability.ts`) antes de insertar; sin extensión `btree_gist` para no depender de SQL extra en migración manual.

### D5 — Pagos como tabla propia derivadora del estado
Estado de pago de la reserva (`payment_status`: `pendiente`|`senada`|`pagada`) derivado de filas en `payments (reservation_id, kind 'seña'|'total', amount, method, external_ref NULLABLE, created_by)`. `external_ref` queda para MP. Se aplican en la app: al registrar `total`, se imputa seña previa; cancelación en término marca la seña como liberada (campo `released`); tardía la retiene (`released = false`). Saldo a favor en `credit_balances (owner_id, customer_phone, amount)`.

### D6 — Auditoría: columnas en reserva + `audit_log` append-only
`created_by`, `updated_by`, `updated_at` en `reservations` (backfill `= user_id` en migración) + `audit_log (owner_id, actor_id, entity, entity_id, action, payload jsonb, created_at)` escrito por la capa de datos (Server Actions / hooks vía RPC). Trigger de BD solo para `updated_at`; el resto se escribe explícitamente para mantener la lógica en TypeScript.

### D7 — Planilla mobile-first: vistas distintas por breakpoint
Desktop: grid tabla canchas×horarios actual (mejorado con franjas por duración). Mobile (`< lg`): selector de cancha + lista vertical de franjas del día con estado (libre/ocupada) y acciones (crear/editar/cobrar/cancelar) — mismo Dialog de detalle reutilizado. Implementación con estado local + `useMediaQuery` hook propio (sin librería nueva). Buscador de disponibilidad: Dialog "Buscar disponibilidad" con fecha, franja opcional y tipo de cancha; resultado = lista de slots libres calculados con `lib/availability.ts`.

### D8 — Enforcement de roles en Server Actions + RLS doble
RLS garantiza aislamiento entre clubes y lectura; Server Actions verifican rol (`requireRole('admin')` etc. en `lib/auth.ts` usando el server client) para operaciones (configurar canchas, políticas, miembros; restricción de cancelación del profe). El cliente oculta lo que no aplica, pero la autoridad es servidor.

## Risks / Trade-offs

- [Migración manual de SQL en dashboard de Supabase] → Scripts idempotentes (`IF NOT EXISTS`, defaults en `ALTER`), verificación paso a paso en tasks, documentación en PROJECT_DOCUMENTATION.md.
- [RLS con memberships puede bloquear acceso si la función queda mal] → Función `SECURITY DEFINER` mínima, grants explícitos, y task de verificación con dos usuarios antes de tocar UI.
- [Duración variable rompe la grilla alineada entre canchas con distinta duración] → La grilla usa franjas de 30 min como "mínimo común"; los turnos más largos ocupan celdas contiguas en desktop; en mobile cada cancha lista sus propias franjas.
- [Cancelación lógica acumula filas] → Aceptable en este volumen; la planilla filtra `status='active'` y se puede agregar limpieza posterior.
- [Estado de pago derivado puede desincronizarse si se borran pagos] → No hay delete de pagos en UI; la fuente de verdad son las filas de `payments`.

## Migration Plan

1. Aplicar `0004_memberships_and_rls.sql`: tabla `memberships`, función `is_member`, backfill de membresías admin para usuarios existentes (dueño de sí mismo), policies nuevas que reemplazan a las por `auth.uid()`.
2. Aplicar `0005_courts_business_config.sql`: columnas de precio/duración/horario/seña en `courts` con defaults (no rompe datos).
3. Aplicar `0006_reservations_lifecycle.sql`: columnas de estado/auditoría/pago en `reservations`, drop de constraint única vieja, partial unique index, `payments`, `settings`, `credit_balances`, `audit_log` + policies RLS.
4. Rollback: las migraciones son aditivas; ante problema, revertir policies a las viejas (backup del SQL previo en el mismo archivo comentado) — sin borrar columnas nuevas para no perder datos.

## Open Questions

- Métodos de pago manuales disponibles al registrar un cobro (efectivo/transferencia/otro) — definible en implementación, no afecta specs.
- ¿Mostrar penalidades/deudas como reporte? Se difiere con el módulo de reportes (mock por ahora); los datos quedan en `payments`/`audit_log`.
