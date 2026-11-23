-- Catálogos de la caja.
-- - `products`: lo que se vende (pelotas, grips, bebidas…) con su precio. Al registrar una venta se elige
--   el producto y el precio viene cargado. La venta guarda nombre y precio del momento (`cash_movements`),
--   así cambiar el catálogo no toca lo ya vendido.
-- - `cash_payees`: a quién se le paga en las salidas (empleados, profes y proveedores), tengan o no
--   usuario en la app. La salida guarda el nombre en `cash_movements.counterparty`.
-- Nada se borra: se desactiva (deja de ofrecerse).

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  price numeric(12,2) not null check (price > 0),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_club_name_idx on public.products (club_id, lower(btrim(name)));

alter table public.products enable row level security;

-- El equipo los lee (el operador vende); solo el admin los carga y los cambia.
create policy "products_select_staff" on public.products
  for select to authenticated using (public.is_staff(club_id));
create policy "products_insert_admin" on public.products
  for insert to authenticated with check (public.is_admin(club_id));
create policy "products_update_admin" on public.products
  for update to authenticated using (public.is_admin(club_id)) with check (public.is_admin(club_id));

drop trigger if exists products_subscription_writable on public.products;
create trigger products_subscription_writable
before insert or update or delete on public.products
for each row execute function public.enforce_subscription_writable();

revoke all on table public.products from anon;

create table if not exists public.cash_payees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('empleado', 'profe', 'proveedor')),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cash_payees_club_name_idx on public.cash_payees (club_id, lower(btrim(name)));

alter table public.cash_payees enable row level security;

-- Las salidas son del admin: solo él ve y cambia a quién se le paga.
create policy "cash_payees_select_admin" on public.cash_payees
  for select to authenticated using (public.is_admin(club_id));
create policy "cash_payees_insert_admin" on public.cash_payees
  for insert to authenticated with check (public.is_admin(club_id));
create policy "cash_payees_update_admin" on public.cash_payees
  for update to authenticated using (public.is_admin(club_id)) with check (public.is_admin(club_id));

drop trigger if exists cash_payees_subscription_writable on public.cash_payees;
create trigger cash_payees_subscription_writable
before insert or update or delete on public.cash_payees
for each row execute function public.enforce_subscription_writable();

revoke all on table public.cash_payees from anon;
