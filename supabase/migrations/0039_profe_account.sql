-- Cuenta del profe con el club (openspec/changes/profe-account).
-- Lo que el profe debe se acumula día a día con los turnos que ya jugó (desde "Liquidar desde").
-- Al cobrar se elige el total u otro monto: el pago se imputa a los turnos más viejos primero
-- (los cubiertos quedan pagados; el último puede quedar señado con un pago parcial).
-- 1) `settle_profe_amount`: cobra un monto (null = todo lo que debe) en una sola transacción.
-- 2) `void_profe_settlement`: también deshace pagos parciales (recalcula el estado de cada turno).
-- 3) El profe puede ver sus propios pagos (`profe_settlements`) para mirar su cuenta.

create or replace function public.settle_profe_amount(
  p_club_id uuid,
  p_profe_user_id uuid,
  p_amount numeric,
  p_method text
) returns table (settlement_id uuid, settled_count int, settled_amount numeric, remaining numeric)
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
  v_total_due numeric := 0;
  v_left numeric;
  v_part numeric;
  v_count int := 0;
  v_total numeric := 0;
  v_ids uuid[] := '{}';
  v_settlement uuid;
begin
  if not public.is_admin(p_club_id) then
    raise exception 'Solo el administrador cobra a los profes.' using errcode = '42501';
  end if;
  if p_method not in ('efectivo', 'mercado_pago') then
    raise exception 'Elegí efectivo o Mercado Pago.' using errcode = '22023';
  end if;
  if p_amount is not null and p_amount <= 0 then
    raise exception 'El monto tiene que ser mayor a cero.' using errcode = '22023';
  end if;

  select st.settle_from into v_from from public.settings st where st.club_id = p_club_id;

  -- Turnos jugados sin pagar, del más viejo al más nuevo (bloqueados para que no se cobren dos veces).
  create temp table if not exists _profe_due (id uuid, price numeric, paid numeric, due numeric, ord int) on commit drop;
  truncate _profe_due;
  insert into _profe_due
  select res.id, coalesce(res.price, 0), coalesce(pay.paid, 0),
         greatest(0, coalesce(res.price, 0) - coalesce(pay.paid, 0)),
         row_number() over (order by res.date, res.time, res.id)
  from public.reservations res
  left join lateral (
    select sum(p.amount) as paid from public.payments p where p.reservation_id = res.id and not p.released
  ) pay on true
  where res.club_id = p_club_id
    and res.kind = 'profe'
    and res.profe_user_id = p_profe_user_id
    and res.status = 'active'
    and res.payment_status <> 'pagada'
    and coalesce(res.pricing_mode, 'lista') not in ('sin_cargo', 'por_persona')
    and (v_from is null or res.date >= v_from)
    and (res.date < v_today or (res.date = v_today and public.hhmm_to_minutes(res.time) + res.duration_minutes <= v_now));

  perform 1 from public.reservations res where res.id in (select id from _profe_due) for update;

  select coalesce(sum(due), 0) into v_total_due from _profe_due;
  if v_total_due <= 0 then
    raise exception 'El profe no debe nada.' using errcode = '22023';
  end if;
  if p_amount is not null and p_amount > v_total_due then
    raise exception 'El monto supera lo que debe el profe (%).', v_total_due using errcode = '22023';
  end if;
  v_left := coalesce(p_amount, v_total_due);

  insert into public.profe_settlements (club_id, profe_user_id, period_from, period_to, method, created_by)
  values (p_club_id, p_profe_user_id, v_from, v_today, p_method, auth.uid())
  returning id into v_settlement;

  for r in select * from _profe_due order by ord loop
    exit when v_left <= 0;
    v_due := r.due;
    if v_due <= 0 then
      -- Turno de $0 jugado: queda pagado sin cobro.
      update public.reservations set payment_status = 'pagada', updated_by = auth.uid() where id = r.id;
      v_ids := v_ids || r.id;
      v_count := v_count + 1;
      continue;
    end if;
    v_part := least(v_due, v_left);
    insert into public.payments (club_id, reservation_id, kind, amount, method, created_by, settlement_id)
    values (
      p_club_id, r.id,
      case when v_part >= v_due then (case when r.paid > 0 then 'saldo' else 'total' end) else 'seña' end,
      v_part, p_method, auth.uid(), v_settlement
    );
    update public.reservations
    set payment_status = case when v_part >= v_due then 'pagada' else 'senada' end,
        updated_by = auth.uid()
    where id = r.id;
    v_left := v_left - v_part;
    v_total := v_total + v_part;
    v_count := v_count + 1;
    v_ids := v_ids || r.id;
  end loop;

  update public.profe_settlements
  set amount = v_total, turns_count = v_count, reservation_ids = v_ids
  where id = v_settlement;

  return query select v_settlement, v_count, v_total, v_total_due - v_total;
end;
$$;

-- Deshacer: borra los cobros de la liquidación y recalcula cada turno según los cobros que le quedan.
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

  update public.reservations res
  set payment_status = case
        when coalesce(pay.paid, 0) >= coalesce(res.price, 0) and coalesce(res.price, 0) > 0 then 'pagada'
        when coalesce(pay.paid, 0) > 0 then 'senada'
        else 'pendiente'
      end,
      updated_by = auth.uid()
  from (
    select r2.id, (select sum(p.amount) from public.payments p where p.reservation_id = r2.id and not p.released) as paid
    from public.reservations r2
    where r2.id = any (s.reservation_ids)
  ) pay
  where res.id = pay.id
    and res.club_id = s.club_id
    and res.status = 'active'
    and res.payment_status in ('pagada', 'senada');
  get diagnostics v_count = row_count;

  update public.profe_settlements
  set voided_at = now(), voided_by = auth.uid()
  where id = s.id;

  return query select v_count, v_amount;
end;
$$;

-- El profe ve sus propios pagos.
drop policy if exists "profe_settlements_select_own" on public.profe_settlements;
create policy "profe_settlements_select_own" on public.profe_settlements
  for select to authenticated
  using (profe_user_id = auth.uid());

revoke execute on function public.settle_profe_amount(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.settle_profe_amount(uuid, uuid, numeric, text) to authenticated;
