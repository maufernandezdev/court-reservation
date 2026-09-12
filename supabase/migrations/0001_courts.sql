-- Tabla de canchas del club, aisladas por usuario autenticado (RLS).

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
  for select to authenticated
  using (user_id = auth.uid());

create policy "courts_insert_own" on public.courts
  for insert to authenticated
  with check (user_id = auth.uid());
