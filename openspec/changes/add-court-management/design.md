## Context

El dashboard es 100% client-side (`"use client"` + `AuthGuard`, ver `app/dashboard/layout.tsx` y `app/dashboard/page.tsx`). La auth vive en Supabase con el patrón `@supabase/ssr` (`lib/supabase/client.ts`, `hooks/use-auth.ts`). No existe todavía infraestructura de migraciones (sin carpeta `supabase/` ni CLI local configurado), ni ninguna tabla de dominio — esta es la primera. La grilla de reservas usa canchas mock y no se toca en este cambio.

## Goals / Non-Goals

**Goals:**
- Primera tabla de dominio con RLS correcto desde el día uno (aislamiento por usuario).
- Sección "Canchas" en el dashboard consistente con el resto del diseño (shadcn/ui, español/voseo, formularios con Zod + react-hook-form según `AGENTS.md`).
- Patrón de acceso a datos reutilizable para las próximas entidades (socios, reservas, productos).
- Grilla de reservas alimentada por las canchas reales del usuario, con filtro por tipo.

**Non-Goals:**
- Editar/eliminar canchas, precios, horarios o disponibilidad.
- Conectar la grilla de reservas a las canchas reales.
- Migraciones gestionadas por CLI o CI (se aplica SQL manual por ahora).

## Decisions

### 1. Tabla `courts` con RLS por `user_id`

```sql
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type text not null check (type in ('futbol', 'tenis', 'padel')),
  created_at timestamptz not null default now()
);

alter table public.courts enable row level security;

create index courts_user_id_idx on public.courts (user_id);

create policy "courts_select_own" on public.courts
  for select to authenticated using (user_id = auth.uid());
create policy "courts_insert_own" on public.courts
  for insert to authenticated with check (user_id = auth.uid());
```

- `on delete cascade`: si se borra el usuario, no quedan canchas huérfanas (mismo criterio que los usuarios unconfirmed mencionados en `docs/PROJECT_DOCUMENTATION.md`).
- El `check` en `name` complementa la validación de Zod en el cliente con una garantía a nivel base de datos.
- **Alternativa considerada:** agregar `updated_at` y soft-delete (`deleted_at`). Rechazada: no hay edición/baja en este cambio; se agrega cuando haga falta.

### 2. Valores de `type` en kebab-case, labels en español

Se guardan claves estables (`futbol`, `tenis`, `padel`) y se mapean a labels ("Fútbol", "Tenis", "Pádel") en la UI. Evita problemas de acentos/comparaciones y permite renombrar el label sin migrar datos.

### 3. SQL en `supabase/migrations/`, aplicado manual vía SQL Editor

Se guarda el DDL en `supabase/migrations/0001_courts.sql` dentro del repo para que sea reproducible y versionado, pero se aplica copiándolo en el SQL Editor del dashboard (no hay CLI local configurado todavía).
- **Alternativa considerada:** instalar/configurar Supabase CLI y `supabase db push`. Rechazada por ahora: agrega setup (Docker) que no se justifica con una sola tabla; se adopta cuando haya más migraciones.

### 4. Acceso a datos client-side con hook dedicado

Nuevo `hooks/use-courts.ts` que carga las canchas con el browser client (`lib/supabase/client.ts`), expone `{ courts, isLoading, createCourt }`, y refresca la lista tras el alta. Sigue el patrón de `use-auth.ts`.
- **Alternativa considerada:** Server Components con `lib/supabase/server.ts`. Rechazada por ahora: todo el dashboard es client-side y AuthGuard depende del estado de sesión en el cliente; introducir RSC para una sola página rompería la consistencia sin beneficio claro. Se reevalúa cuando se conecten reservas.

### 5. UI: página `/dashboard/canchas` + item en sidebar

- Item "Canchas" en `app/dashboard/layout.tsx` (icono sugerido: `LandPlot` de lucide) entre las secciones existentes.
- Página con estado vacío (mensaje + CTA "Crear tu primera cancha"), lista de canchas como cards o tabla simple mostrando nombre y label de tipo, y botón "Nueva cancha" que abre un `Dialog` de shadcn/ui con el formulario (react-hook-form + zodResolver, schema `courtSchema` en el mismo archivo — regla de `AGENTS.md`).
- No se usa realtime: basta con refetch tras insert para este alcance.

### 5. Grilla de reservas: canchas reales + filtro por tipo

- La página `/dashboard/reservas` consume el mismo hook `useCourts()` en lugar del array de canchas mock: las columnas son las canchas reales del usuario. Esto unifica la fuente de verdad: crear una cancha en `/dashboard/canchas` la hace aparecer automáticamente en la grilla.
- Filtro por tipo: estado local `courtTypeFilter: CourtType | "all"` y un `Select` de shadcn/ui en la barra de herramientas de la grilla (opciones: Todas, Fútbol, Tenis, Pádel). El filtrado es client-side sobre la lista ya cargada (volumen de canchas de un club: trivial).
- Estados en la página: loading (spinner, mientras `useCourts` carga), empty (sin canchas: mensaje + botón que navega a `/dashboard/canchas`).
- **Alternativa considerada:** filtrar en la query de Supabase (`.eq("type", ...)`). Rechazada: traer todas las canchas una sola vez y filtrar local es más simple y la diferencia de datos es despreciable.
- Las reservas de la grilla siguen siendo mock en este change (conectar la tabla `reservations` es un cambio aparte).

## Risks / Trade-offs

- **RLS mal configurado expone canchas entre usuarios** → verificar con dos usuarios distintos (ya hay `test@user.com` y se puede crear otro) que cada uno solo ve lo suyo; el spec "Aislamiento entre usuarios" cubre este caso.
- **Aplicación manual del SQL** → el archivo en `supabase/migrations/` puede desincronizarse de la base real; mitigación: documentarlo en `docs/PROJECT_DOCUMENTATION.md` y migrar a CLI cuando crezca.
- **Sin índice explícito en `user_id`** → con RLS por `user_id`, Postgres no indexa automáticamente; las listas filtran por dueño. Para el volumen de un club es irrelevante, pero se agrega `create index` en la migración de todas formas (costo cero, evita el riesgo).

## Migration Plan

1. Aplicar `supabase/migrations/0001_courts.sql` en el SQL Editor del proyecto Supabase.
2. Deploy del código (alta de la página, hook y sidebar).
3. Rollback: `drop table public.courts;` (la tabla es nueva, no hay datos que preservar) + revert del commit.
