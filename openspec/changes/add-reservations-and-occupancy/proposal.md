## Why

La home del dashboard (`/dashboard`) hoy solo redirige a `/dashboard/reservas` — no muestra nada. Queremos que sea un mapa de ocupación del club: qué canchas están en curso ahora. Para eso las reservas tienen que ser reales (hoy son mock): sin tabla `reservations` no hay ocupación que mostrar.

## What Changes

- Nueva tabla `reservations` en Supabase: `user_id` (→ `auth.users`), `court_id` (→ `courts`, cascade), `date`, `time` (franja de inicio, bloques de 1h como la grilla), `customer_name`, `phone`, con constraint único `(court_id, date, time)` que impide doble reserva a nivel base de datos, y RLS para que cada usuario solo vea y toque sus propias reservas.
- La grilla de reservas (`/dashboard/reservas`) persiste de verdad: crear, editar y eliminar reservas guardan en Supabase (dejan de ser estado mock local).
- Nueva home `/dashboard`: mapa de ocupación actual — todas las canchas del usuario con su estado (ocupada con titular y franja horaria / disponible), con filtro por tipo (todas/fútbol/tenis/pádel). `/dashboard` deja de redirigir a `/dashboard/reservas`.
- Fuera de alcance: pagos/señas por reserva, reservas recurrentes, duración variable (todo bloque de 1h), notificaciones.

## Capabilities

### New Capabilities
- `reservations/management`: persistencia de reservas del club por usuario autenticado (alta, listado por fecha, edición y baja) con integridad de slot único por cancha/fecha/hora.
- `dashboard/occupancy`: home del dashboard que muestra la ocupación actual de las canchas del club, con filtro por tipo.

### Modified Capabilities
- `reservations/booking-grid`: el alta, edición y baja de reservas desde la grilla persisten en Supabase (reemplaza el estado mock); la visualización carga las reservas reales por fecha.

## Impact

- **Base de datos (Supabase):** nueva migración `supabase/migrations/0002_reservations.sql` (tabla + FK + unique + RLS + índice), aplicada manual como `0001`.
- **Código:** nuevo hook `hooks/use-reservations.ts`; refactor de `app/dashboard/reservas/page.tsx` (persistencia); nueva home en `app/dashboard/page.tsx` (reemplaza el redirect); componente de filtro por tipo reutilizable entre reservas y home.
- **Dependencias:** requiere el change `add-court-management` implementado (canchas reales).
- **Mock data:** las reservas mock de `lib/mocks/data.ts` dejan de usarse en la grilla (los mocks de socios, productos, etc. siguen).
