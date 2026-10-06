-- Membresías y roles por club.
-- Modelo de tenancy: `user_id` en courts/reservations es el dueño del club (owner).
-- Los miembros (admin/operador/profesor) acceden vía `memberships`.

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'operador', 'profesor')),
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, user_id)
);

alter table public.memberships enable row level security;

create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_owner_id_idx on public.memberships (owner_id);

-- Funciones SECURITY DEFINER: evitan recursión de RLS al consultar memberships
-- desde policies de otras tablas (el owner de la función bypassa RLS).

create or replace function public.is_member(p_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where owner_id = p_owner_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_admin(p_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where owner_id = p_owner_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Resuelve el id de un usuario registrado por email (para invitar miembros al club).
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- Solo usuarios autenticados pueden resolver emails (evita enumeración con la anon key).
revoke execute on function public.find_user_id_by_email(text) from public, anon;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- Cada usuario nuevo es admin de su propio club (onboarding).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (owner_id, user_id, role, email)
  values (new.id, new.id, 'admin', coalesce(new.email, ''))
  on conflict (owner_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Ajuste atómico de saldo a favor (evita lost updates en read-modify-write).
create or replace function public.adjust_credit_balance(
  p_owner_id uuid,
  p_phone text,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
begin
  if not public.is_staff(p_owner_id) then
    raise exception 'Solo el personal del club puede mover saldos a favor'
      using errcode = '42501';
  end if;

  insert into public.credit_balances (owner_id, customer_phone, amount)
  values (p_owner_id, p_phone, p_delta)
  on conflict (owner_id, customer_phone)
  do update set
    amount = public.credit_balances.amount + p_delta,
    updated_at = now()
  returning amount into v_amount;
  return v_amount;
end;
$$;

revoke execute on function public.adjust_credit_balance(uuid, text, numeric) from public, anon;
grant execute on function public.adjust_credit_balance(uuid, text, numeric) to authenticated;

create or replace function public.is_staff(p_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where owner_id = p_owner_id
      and user_id = auth.uid()
      and role in ('admin', 'operador')
  );
$$;

-- Backfill: cada usuario existente queda como admin de su propio club
-- (cubre dueños con datos y cuentas registradas aún sin uso).
insert into public.memberships (owner_id, user_id, role, email)
select id, id, 'admin', coalesce(email, '') from auth.users
on conflict (owner_id, user_id) do nothing;

-- RLS de memberships: se ven los miembros de mis clubes; solo un admin del club los gestiona.
create policy "memberships_select" on public.memberships
  for select to authenticated
  using (is_member(owner_id));

create policy "memberships_admin_insert" on public.memberships
  for insert to authenticated
  with check (is_admin(owner_id));

create policy "memberships_admin_update" on public.memberships
  for update to authenticated
  using (is_admin(owner_id))
  with check (is_admin(owner_id));

create policy "memberships_admin_delete" on public.memberships
  for delete to authenticated
  using (is_admin(owner_id));

-- Reemplazo de policies por auth.uid() → acceso por membresía.
-- Canchas: lectura/edicion para miembros del club; alta solo para admin (el club es propio).
drop policy if exists "courts_select_own" on public.courts;
drop policy if exists "courts_insert_own" on public.courts;
drop policy if exists "courts_update_own" on public.courts;

create policy "courts_select_member" on public.courts
  for select to authenticated
  using (is_member(user_id));

create policy "courts_insert_admin" on public.courts
  for insert to authenticated
  with check (is_admin(user_id));

-- Configurar canchas (precios, horarios, sena) es tarea exclusiva del admin del club.
create policy "courts_update_admin" on public.courts
  for update to authenticated
  using (is_admin(user_id))
  with check (is_admin(user_id));

-- Reservas: lectura/escritura para miembros del club (las reglas de negocio
-- de roles viven en Server Actions; el RLS garantiza el aislamiento entre clubes).
drop policy if exists "reservations_select_own" on public.reservations;
drop policy if exists "reservations_insert_own" on public.reservations;
drop policy if exists "reservations_update_own" on public.reservations;
drop policy if exists "reservations_delete_own" on public.reservations;

create policy "reservations_select_member" on public.reservations
  for select to authenticated
  using (is_member(user_id));

create policy "reservations_insert_member" on public.reservations
  for insert to authenticated
  with check (is_member(user_id));

create policy "reservations_update_member" on public.reservations
  for update to authenticated
  using (is_member(user_id))
  with check (is_member(user_id));

create policy "reservations_delete_member" on public.reservations
  for delete to authenticated
  using (is_member(user_id));
