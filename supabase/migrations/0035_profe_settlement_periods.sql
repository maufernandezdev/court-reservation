-- Liquidación de profes por período (openspec/changes/profe-settlement-periods).
-- 1) "Liquidar desde" por club (`settings.settle_from`): lo anterior no cuenta como deuda en Liquidar.
-- 2) Historial: cada liquidación queda en `profe_settlements` y sus cobros llevan `payments.settlement_id`.
-- 3) `settle_profe_pending`: cobra todo lo pendiente del profe hasta una fecha, sin liquidar el futuro
--    (de hoy solo cuentan los turnos ya terminados).
-- 4) `void_profe_settlement`: deshace una liquidación (solo admin): borra sus cobros y devuelve los
--    turnos a pendiente (o señado si les queda otro cobro).

alter table public.settings
  add column if not exists settle_from date;

create table if not exists public.profe_settlements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profe_user_id uuid not null references auth.users(id),
  period_from date,
  period_to date not null,
  method text not null check (method in ('efectivo', 'mercado_pago')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  turns_count int not null default 0 check (turns_count >= 0),
  reservation_ids uuid[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id)
);

create index if not exists profe_settlements_club_idx on public.profe_settlements (club_id, created_at desc);

alter table public.profe_settlements enable row level security;

drop policy if exists "profe_settlements_select_admin" on public.profe_settlements;
create policy "profe_settlements_select_admin" on public.profe_settlements
  for select to authenticated
  using (public.is_admin(club_id));

-- Las escrituras van solo por las funciones de abajo.
revoke all on table public.profe_settlements from anon;
revoke insert, update, delete on table public.profe_settlements from authenticated;
grant select on table public.profe_settlements to authenticated;

drop trigger if exists profe_settlements_subscription_writable on public.profe_settlements;
create trigger profe_settlements_subscription_writable
before insert or update or delete on public.profe_settlements
for each row execute function public.enforce_subscription_writable();

alter table public.payments
  add column if not exists settlement_id uuid references public.profe_settlements(id) on delete set null;
create index if not exists payments_settlement_id_idx on public.payments (settlement_id) where settlement_id is not null;

-- Minutos transcurridos del día en Argentina (para saber qué turnos de hoy ya terminaron).
create or replace function public.now_minutes_ar() returns int
language sql
stable
as $$
  select (extract(hour from (now() at time zone 'America/Argentina/Buenos_Aires'))::int * 60
        + extract(minute from (now() at time zone 'America/Argentina/Buenos_Aires'))::int);
$$;

create or replace function public.settle_profe_pending(
  p_club_id uuid,
  p_profe_user_id uuid,
  p_until date,
  p_method text
) returns table (settlement_id uuid, settled_count int, settled_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_from date;
  v_today date := public.today_ar();
  v_now int := public.now_minutes_ar();
  v_paid numeric;
  v_due numeric;
  v_count int := 0;
  v_total numeric := 0;
  v_ids uuid[] := '{}';
  v_settlement uuid;
begin
  if not public.is_admin(p_club_id) then
    raise exception 'Solo el administrador registra liquidaciones de profes.' using errcode = '42501';
  end if;
  if p_method not in ('efectivo', 'mercado_pago') then
    raise exception 'Elegí efectivo o Mercado Pago.' using errcode = '22023';
  end if;
  if p_until is null then
    raise exception 'Elegí hasta qué fecha liquidar.' using errcode = '22023';
  end if;
  if p_until > v_today then
    raise exception 'No se puede liquidar lo que todavía no pasó.' using errcode = '22023';
  end if;

  select st.settle_from into v_from from public.settings st where st.club_id = p_club_id;
  if v_from is not null and p_until < v_from then
    raise exception 'La fecha es anterior a "Liquidar desde".' using errcode = '22023';
  end if;

  insert into public.profe_settlements (club_id, profe_user_id, period_from, period_to, method, created_by)
  values (p_club_id, p_profe_user_id, v_from, p_until, p_method, auth.uid())
  returning id into v_settlement;

  for r in
    select res.id, coalesce(res.price, 0) as price
    from public.reservations res
    where res.club_id = p_club_id
      and res.kind = 'profe'
      and res.profe_user_id = p_profe_user_id
      and res.status = 'active'
      and res.payment_status <> 'pagada'
      and (v_from is null or res.date >= v_from)
      and res.date <= p_until
      and (res.date < v_today or public.hhmm_to_minutes(res.time) + res.duration_minutes <= v_now)
    order by res.date, res.time
    for update
  loop
    select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
    where p.reservation_id = r.id and not p.released;

    v_due := greatest(0, r.price - v_paid);
    if v_due > 0 then
      insert into public.payments (club_id, reservation_id, kind, amount, method, created_by, settlement_id)
      values (p_club_id, r.id, 'total', v_due, p_method, auth.uid(), v_settlement);
      v_total := v_total + v_due;
    end if;

    update public.reservations
    set payment_status = 'pagada', updated_by = auth.uid()
    where id = r.id;
    v_count := v_count + 1;
    v_ids := v_ids || r.id;
  end loop;

  if v_count = 0 then
    raise exception 'El profe no tiene turnos pendientes hasta esa fecha.' using errcode = '22023';
  end if;

  update public.profe_settlements
  set amount = v_total, turns_count = v_count, reservation_ids = v_ids
  where id = v_settlement;

  return query select v_settlement, v_count, v_total;
end;
$$;

create or replace function public.void_profe_settlement(p_settlement_id uuid)
returns table (reverted_count int, reverted_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.profe_settlements%rowtype;
  v_amount numeric := 0;
  v_count int := 0;
begin
  select * into s from public.profe_settlements where id = p_settlement_id for update;
  if not found or not public.is_admin(s.club_id) then
    raise exception 'No se encontró la liquidación.' using errcode = '42501';
  end if;
  if s.voided_at is not null then
    raise exception 'Esa liquidación ya se deshizo.' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_amount from public.payments where settlement_id = s.id;
  delete from public.payments where settlement_id = s.id;

  -- Los turnos vuelven a pendiente o a señado si les queda otro cobro.
  update public.reservations res
  set payment_status = case
        when exists (select 1 from public.payments p where p.reservation_id = res.id and not p.released)
          then 'senada'
        else 'pendiente'
      end,
      updated_by = auth.uid()
  where res.id = any (s.reservation_ids)
    and res.club_id = s.club_id
    and res.status = 'active'
    and res.payment_status = 'pagada';
  get diagnostics v_count = row_count;

  update public.profe_settlements
  set voided_at = now(), voided_by = auth.uid()
  where id = s.id;

  return query select v_count, v_amount;
end;
$$;

revoke execute on function public.settle_profe_pending(uuid, uuid, date, text) from public, anon;
grant execute on function public.settle_profe_pending(uuid, uuid, date, text) to authenticated;
revoke execute on function public.void_profe_settlement(uuid) from public, anon;
grant execute on function public.void_profe_settlement(uuid) to authenticated;
