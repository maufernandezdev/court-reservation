## Context

Ya existen las canchas reales (change `add-court-management`): tabla `public.courts` con RLS por usuario y hook `useCourts`. La grilla de reservas (`app/dashboard/reservas/page.tsx`) renderiza canchas y reservas desde `lib/mocks/data.ts` con estado local. La home (`app/dashboard/page.tsx`) solo hace `router.replace("/dashboard/reservas")`. Todas las páginas del dashboard son client-side tras `AuthGuard`. Las migraciones se aplican a mano desde `supabase/migrations/` (ver `docs/PROJECT_DOCUMENTATION.md`).

## Goals / Non-Goals

**Goals:**
- Reservas reales persistidas por usuario, con imposibilidad de doble reserva de un mismo slot garantizada por la base de datos.
- Grilla de reservas funcionando de punta a punta contra Supabase (crear/editar/eliminar).
- Home del dashboard convertida en mapa de ocupación actual, filtrable por tipo.

**Non-Goals:**
- Duración variable de reservas (siempre bloques de 1h, como la grilla), reservas recurrentes, señas/pagos.
- Tiempo real (realtime): la ocupación se calcula al cargar la página, con botón de refrescar manual.
- Conexión de socios/miembros a las reservas (sigue todo mock salvo canchas y reservas).

## Decisions

### 1. Tabla `reservations` con constraint único de slot

```sql
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  date date not null,
  time text not null,               -- 'HH:00', franja de inicio, bloques de 1h
  customer_name text not null check (char_length(trim(customer_name)) > 0),
  phone text not null default '',
  created_at timestamptz not null default now(),
  unique (court_id, date, time)
);

alter table public.reservations enable row level security;

create index reservations_user_date_idx on public.reservations (user_id, date);

create policy "reservations_select_own" on public.reservations
  for select to authenticated using (user_id = auth.uid());
create policy "reservations_insert_own" on public.reservations
  for insert to authenticated with check (user_id = auth.uid());
create policy "reservations_update_own" on public.reservations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reservations_delete_own" on public.reservations
  for delete to authenticated using (user_id = auth.uid());
```

- El `unique (court_id, date, time)` hace imposible la doble reserva a nivel base de datos (la spec ya pedía prevent double booking; esto lo garantiza además del chequeo en UI). El cliente traduce el error de unique violation (Supabase devuelve código `23505`) en el mensaje "Esa cancha ya está reservada en ese horario".
- `time` como texto `HH:00` mantiene compatibilidad con el modelo mock y la grilla (bloques desde 09:00). **Alternativa considerada:** `time`/`timetz` o rango con `end`. Rechazada: la duración es fija (1h); un rango agrega complejidad sin beneficio hasta que existan duraciones variables.
- `court_id` no tiene check de propiedad a nivel SQL (RLS de `courts` ya impide leer canchas ajenas, pero insertar una reserva con `court_id` ajeno no queda bloqueado por esta policy: la fila sería del usuario pero apuntando a cancha ajena). Mitigación: el hook siempre toma el `court_id` desde las canchas cargadas del propio usuario (nunca de input libre), y la verificación de punta a punta (task 5.x) incluye el intento de insert con cancha ajena. Si más adelante se expone una API, agregar un trigger de validación.

### 2. Hook `use-reservations.ts` por fecha

`{ reservations, isLoading, error, createReservation, updateReservation, deleteReservation }`, cargando con `.eq("date", selectedDate)` y ordenado por `time`. Sigue el patrón de `use-courts.ts`. El estado local de reservas mock de la grilla se reemplaza por este hook.

### 3. Home de ocupación: `/dashboard` deja de redirigir

- `app/dashboard/page.tsx` pasa a ser la página de ocupación (client component con `AuthGuard`, que ya envuelve el layout).
- "En curso": franja horaria actual — el bloque de 1h (alineado a la grilla, desde 09:00) que contiene la hora actual, para la fecha de hoy. Cancha con reserva en ese bloque → ocupada (muestra titular y franja, ej. "18:00 – 19:00"); si no → disponible.
- Datos: `useCourts()` + `useReservations(today)`; el join cancha↔reserva se hace en memoria.
- UI: título "Ocupación actual" + hora, filtro por tipo (mismo patrón de Select que reservas), grid de cards por cancha con badge de estado (verde "Disponible" / ocupada con titular y franja), estado vacío con CTA a `/dashboard/canchas`, y botón "Refrescar" para recargar.
- El componente de filtro por tipo se extrae a `components/court-type-filter.tsx` para reusarlo en reservas y home (reservas lo adopta en este change o en el apply de `add-court-management` — se resuelve en apply para no duplicar).

### 4. Eliminación del mock de reservas en la grilla

`app/dashboard/reservas/page.tsx` deja de importar las reservas mock; conserva la navegación por fecha y los dialogs (ahora persistiendo vía hook). `lib/mocks/data.ts` conserva el resto de mocks (socios, productos, caja, etc.); solo se dejan de usar `mockReservations` y el type `Reservation` en la grilla.

## Risks / Trade-offs

- **Carrera al crear dos reservas al mismo tiempo** → el constraint único es la fuente final de verdad; la UI muestra el error y refresca.
- **Zona horaria de `date`** → las fechas se manejan como strings `YYYY-MM-DD` (mismo criterio que el mock); la franja "actual" se calcula con la hora local del navegador. Aceptable para uso en un único país; documentar si el club opera en varias zonas.
- **Usuarios existentes con reservas mock** → no aplica: las reservas mock eran estado local, nadie tenía datos reales que migrar.
- **Reservas huérfanas al borrar canchas** → `on delete cascade` en `court_id`: borrar una cancha (cuando exista la baja) elimina sus reservas. Comportamiento deseado, pero a tener en cuenta cuando se agregue la baja de canchas.

## Migration Plan

1. Aplicar `supabase/migrations/0002_reservations.sql` en el SQL Editor (mismo proceso manual que `0001`).
2. Deploy del código (hook, grilla, home).
3. Rollback: `drop table public.reservations;` + revert del commit. No hay datos previos que preservar.

## Open Questions

- Ninguna: el alcance de duración fija de 1h y de "en curso = bloque actual" quedó confirmado con el usuario (ver conversación del change).
