-- Tabla de reservas del club, aisladas por usuario autenticado (RLS).
-- `time` es la franja de inicio "HH:00" en bloques de 1h (alineada a la grilla, desde 09:00).

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
  for select to authenticated
  using (user_id = auth.uid());

create policy "reservations_insert_own" on public.reservations
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "reservations_update_own" on public.reservations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reservations_delete_own" on public.reservations
  for delete to authenticated
  using (user_id = auth.uid());

-- La policy de RLS no valida la propiedad de la cancha (la fila es del usuario
-- pero podría apuntar a una court_id ajena). Este trigger cierra ese hueco:
-- rechaza insert/update cuya cancha no pertenezca al mismo usuario.
create or replace function public.check_reservation_court_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.courts
    where id = new.court_id and user_id = new.user_id
  ) then
    raise exception 'La cancha no pertenece al usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reservations_check_court_owner
before insert or update on public.reservations
for each row execute function public.check_reservation_court_owner();
