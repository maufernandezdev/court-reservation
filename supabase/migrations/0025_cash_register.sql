-- Caja del club: la planilla de entradas y salidas del día.
-- - Los cobros aceptan Mercado Pago (transferencia y otro siguen válidos para cobros viejos).
-- - `cash_movements`: ventas de accesorios, otros ingresos y salidas (liquidaciones, gastos, retiros).
--   Nunca se borran: se anulan (quedan tachados).
-- - `cash_openings`: el cambio inicial de cada día.

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('efectivo', 'mercado_pago', 'transferencia', 'otro'));

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  date date not null,
  type text not null check (type in ('in', 'out')),
  category text not null,
  concept text not null default '' check (char_length(concept) <= 120),
  counterparty text not null default '' check (char_length(counterparty) <= 120),
  quantity integer check (quantity is null or quantity between 1 and 999),
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('efectivo', 'mercado_pago', 'transferencia', 'otro')),
  note text not null default '' check (char_length(note) <= 200),
  voided boolean not null default false,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint cash_movements_category_check check (
    (type = 'in' and category in ('accesorio', 'otro_ingreso'))
    or (type = 'out' and category in ('liquidacion_profe', 'empleado', 'proveedor', 'gasto_general', 'retiro'))
  ),
  constraint cash_movements_voided_check check (voided = (voided_at is not null))
);

create index if not exists cash_movements_club_date_idx on public.cash_movements (club_id, date);

alter table public.cash_movements enable row level security;

create policy "cash_movements_select_staff" on public.cash_movements
  for select to authenticated
  using (public.is_staff(club_id));

-- El operador registra entradas (ventas); solo el admin registra salidas.
create policy "cash_movements_insert_staff" on public.cash_movements
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and not voided
    and (public.is_admin(club_id) or (public.is_staff(club_id) and type = 'in'))
  );

-- Solo el admin anula (el trigger de abajo impide cambiar cualquier otra cosa).
create policy "cash_movements_update_admin" on public.cash_movements
  for update to authenticated
  using (public.is_admin(club_id))
  with check (public.is_admin(club_id));

-- Un movimiento no se edita: lo único que cambia es pasar a anulado (una vez, sin vuelta atrás).
create or replace function public.protect_cash_movement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.voided then
    raise exception 'El movimiento ya estaba anulado.' using errcode = 'P0001';
  end if;
  if (new.club_id, new.date, new.type, new.category, new.concept, new.counterparty,
      new.quantity, new.amount, new.method, new.note, new.created_by, new.created_at)
     is distinct from
     (old.club_id, old.date, old.type, old.category, old.concept, old.counterparty,
      old.quantity, old.amount, old.method, old.note, old.created_by, old.created_at) then
    raise exception 'Los movimientos de caja no se editan: anulalo y cargalo de nuevo.' using errcode = '42501';
  end if;
  if not new.voided then
    raise exception 'Solo se puede anular el movimiento.' using errcode = '42501';
  end if;
  new.voided_at := now();
  new.voided_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists cash_movements_protect on public.cash_movements;
create trigger cash_movements_protect
before update on public.cash_movements
for each row execute function public.protect_cash_movement();

drop trigger if exists cash_movements_subscription_writable on public.cash_movements;
create trigger cash_movements_subscription_writable
before insert or update or delete on public.cash_movements
for each row execute function public.enforce_subscription_writable();

create table if not exists public.cash_openings (
  club_id uuid not null references public.clubs(id) on delete cascade,
  date date not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (club_id, date)
);

alter table public.cash_openings enable row level security;

create policy "cash_openings_select_staff" on public.cash_openings
  for select to authenticated
  using (public.is_staff(club_id));

create policy "cash_openings_insert_admin" on public.cash_openings
  for insert to authenticated
  with check (public.is_admin(club_id));

create policy "cash_openings_update_admin" on public.cash_openings
  for update to authenticated
  using (public.is_admin(club_id))
  with check (public.is_admin(club_id));

drop trigger if exists cash_openings_subscription_writable on public.cash_openings;
create trigger cash_openings_subscription_writable
before insert or update or delete on public.cash_openings
for each row execute function public.enforce_subscription_writable();

revoke all on table public.cash_movements from anon;
revoke all on table public.cash_openings from anon;
