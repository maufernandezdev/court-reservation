-- Ciclo de vida de reservas: cancelacion logica, pagos, politicas, saldo a favor y auditoria.
-- La reserva ya no se borra: queda con status 'cancelled' y el turno se libera
-- via indice unico parcial (solo reservas activas bloquean el slot).

alter table public.reservations
  add column duration_minutes int not null default 60,
  add column status text not null default 'active' check (status in ('active', 'cancelled')),
  add column payment_status text not null default 'pendiente' check (payment_status in ('pendiente', 'senada', 'pagada')),
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references auth.users(id),
  add column cancel_reason text,
  add column late_cancel boolean not null default false,
  add column created_by uuid references auth.users(id),
  add column updated_by uuid references auth.users(id),
  add column updated_at timestamptz;

-- Backfill de auditoria para filas existentes.
update public.reservations
set created_by = user_id, updated_by = user_id, updated_at = created_at
where created_by is null;

-- El turno solo esta bloqueado mientras la reserva esta activa.
alter table public.reservations drop constraint if exists reservations_court_id_date_time_key;
create unique index if not exists reservations_active_slot_idx
  on public.reservations (court_id, date, time)
  where status = 'active';

-- updated_at automatico.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

-- Pagos (senas / totales / aplicacion de saldo). `external_ref` queda listo para Mercado Pago.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  kind text not null check (kind in ('seña', 'total', 'saldo')),
  amount numeric(10,2) not null check (amount >= 0),
  method text not null default 'efectivo' check (method in ('efectivo', 'transferencia', 'otro')),
  external_ref text,
  released boolean not null default false, -- sena liberada por cancelacion en termino
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create index if not exists payments_reservation_id_idx on public.payments (reservation_id);
create index if not exists payments_owner_id_idx on public.payments (owner_id);

create policy "payments_select_member" on public.payments
  for select to authenticated
  using (is_member(owner_id));

-- Registrar cobros es tarea del personal (admin/operador), no del profesor.
create policy "payments_insert_staff" on public.payments
  for insert to authenticated
  with check (is_staff(owner_id));

create policy "payments_update_staff" on public.payments
  for update to authenticated
  using (is_staff(owner_id))
  with check (is_staff(owner_id));

-- Politicas de cancelacion del club (una fila por club).
create table if not exists public.settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  cancel_window_hours int not null default 24 check (cancel_window_hours >= 0),
  late_penalty_percent numeric(5,2) not null default 50 check (late_penalty_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings_select_member" on public.settings
  for select to authenticated
  using (is_member(owner_id));

create policy "settings_admin_write" on public.settings
  for insert to authenticated
  with check (is_admin(owner_id));

create policy "settings_admin_update" on public.settings
  for update to authenticated
  using (is_admin(owner_id))
  with check (is_admin(owner_id));

-- Saldo a favor / deuda por cliente (identificado por telefono). Negativo = deuda.
create table if not exists public.credit_balances (
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_phone text not null,
  amount numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, customer_phone)
);

alter table public.credit_balances enable row level security;

create policy "credit_select_member" on public.credit_balances
  for select to authenticated
  using (is_member(owner_id));

-- El saldo a favor lo mueve solo el personal del club.
create policy "credit_write_staff" on public.credit_balances
  for insert to authenticated
  with check (is_staff(owner_id));

create policy "credit_update_staff" on public.credit_balances
  for update to authenticated
  using (is_staff(owner_id))
  with check (is_staff(owner_id));

-- Log de auditoria append-only.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
create index if not exists audit_log_owner_idx on public.audit_log (owner_id, created_at desc);

create policy "audit_select_member" on public.audit_log
  for select to authenticated
  using (is_member(owner_id));

-- Solo el personal escribe en la auditoría (el actor lo fija la app).
create policy "audit_insert_staff" on public.audit_log
  for insert to authenticated
  with check (is_staff(owner_id));

-- Protege el cobro y la cancelación tardía a nivel base de datos:
-- - payment_status solo lo cambia el personal del club.
-- - Un profesor no puede cancelar dentro de la ventana de penalidad
--   (la ventana se lee de settings; default 24 hs si el club no configuró).
create or replace function public.protect_reservation_money()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_hours int;
begin
  if new.payment_status is distinct from old.payment_status
     and not public.is_staff(old.user_id) then
    raise exception 'Solo el personal del club puede cambiar el cobro de una reserva'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and new.status = 'cancelled'
     and not public.is_staff(old.user_id) then
    select cancel_window_hours into v_window_hours
    from public.settings where owner_id = old.user_id;
    v_window_hours := coalesce(v_window_hours, 24);

    if old.date + old.time::time < now() + make_interval(hours => v_window_hours) then
      raise exception 'No podés cancelar un turno dentro de la ventana de penalidad. Consultá con un administrador.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_protect_money on public.reservations;
create trigger reservations_protect_money
before update on public.reservations
for each row execute function public.protect_reservation_money();
