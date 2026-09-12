## Why

El proyecto empieza a tomar forma: cada cuenta nueva no tiene canchas configuradas, y hoy la grilla de reservas (`/dashboard/reservas`) usa canchas de ejemplo hardcodeadas/mock. Sin canchas reales persistidas por usuario no hay forma de operar el club. Es el primer paso para darle datos reales al dashboard.

## What Changes

- Nueva sección "Canchas" en el dashboard (`/dashboard/canchas`) con:
  - Listado de las canchas del usuario (estado vacío con llamado a la acción cuando no tiene ninguna).
  - Botón "Nueva cancha" que abre un formulario (validado con Zod + react-hook-form, según reglas del proyecto) con campos: **nombre** (requerido) y **tipo** (requerido: fútbol, tenis o pádel).
  - El usuario puede crear las canchas que quiera, sin límite.
- Nueva tabla `courts` en Supabase, con una fila por cancha y `user_id` referenciando al usuario autenticado (relación con auth).
- Row Level Security (RLS) en Supabase: cada usuario solo lee y escribe sus propias canchas.
- Item "Canchas" en la sidebar del dashboard para acceder a la sección.
- La grilla de reservas (`/dashboard/reservas`) deja de usar canchas hardcodeadas/mock y renderiza las canchas reales del usuario desde Supabase, con estado de carga y estado vacío (con CTA hacia `/dashboard/canchas` cuando el usuario no tiene canchas).
- Filtro por tipo en la grilla de reservas: un select con "Todas", "Fútbol", "Tenis" y "Pádel" que filtra las columnas de la grilla según el tipo elegido.
- Fuera de alcance por ahora: editar/eliminar canchas, precios, horarios y características extra (se definen en cambios futuros).

## Capabilities

### New Capabilities
- `courts/management`: CRUD de canchas del club por usuario autenticado — por ahora alta y listado, persistido en Supabase con aislamiento por usuario (RLS).

### Modified Capabilities
- `reservations/booking-grid`: las columnas de la grilla pasan a ser las canchas reales del usuario (desde Supabase, reemplazando las hardcodeadas) y se agrega un filtro por tipo de cancha (todas/fútbol/tenis/pádel).

## Impact

- **Base de datos (Supabase):** nueva tabla `courts` con migración SQL y políticas RLS.
- **Código:** nueva página `app/dashboard/canchas/`, item en la sidebar (`app/dashboard/layout.tsx`), posiblemente un hook de datos (p. ej. `hooks/use-courts.ts`) siguiendo el patrón de `hooks/use-auth.ts`.
- **Dependencias:** ninguna nueva; se usa el cliente Supabase existente en `lib/supabase/`.
- **Specs futuras:** `reservations/booking-grid` consumirá estas canchas cuando se conecte a datos reales.
