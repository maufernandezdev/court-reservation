-- Vuelta atrás de 0023_profe_own_or_assigned.sql: el profesor vuelve a editar y cancelar solo lo que creó él.
drop policy if exists "reservations_update_staff_or_own" on public.reservations;
create policy "reservations_update_staff_or_own" on public.reservations
  for update to authenticated
  using (is_staff(club_id) or (is_member(club_id) and created_by = auth.uid()))
  with check (is_staff(club_id) or (is_member(club_id) and created_by = auth.uid()));

create or replace function public.cancel_own_profe_reservation(
  p_reservation_id uuid,
  p_reason text default '',
  p_accept_penalty boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r public.reservations%rowtype;
  v_window numeric;
  v_percent numeric;
  v_late boolean;
  v_paid numeric := 0;
  v_penalty numeric := 0;
  v_retained numeric := 0;
  v_released numeric := 0;
  v_debt numeric := 0;
  v_released_actual numeric := 0;
  v_budget numeric;
  v_phone text;
  p record;
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;

  select * into r from public.reservations where id = p_reservation_id for update;
  if not found or not public.is_member(r.club_id) then
    raise exception 'No se encontró la reserva.' using errcode = 'P0002';
  end if;
  if r.created_by is distinct from v_uid then
    raise exception 'Solo podés cancelar los turnos que creaste vos.' using errcode = '42501';
  end if;
  if r.status = 'cancelled' then
    raise exception 'La reserva ya estaba cancelada.' using errcode = 'P0001';
  end if;

  select coalesce(cancel_window_hours, 24), coalesce(late_penalty_percent, 50)
  into v_window, v_percent
  from public.settings where club_id = r.club_id;
  v_window := coalesce(v_window, 24);
  v_percent := coalesce(v_percent, 50);

  v_late := ((r.date + r.time::time) at time zone 'America/Argentina/Buenos_Aires') < now() + v_window * interval '1 hour';
  if v_late and not coalesce(p_accept_penalty, false) then
    raise exception 'La cancelación es fuera de término: tenés que aceptar la penalidad.' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments where reservation_id = r.id and not released;

  if v_late then
    v_penalty := round(r.price * v_percent / 100, 2);
    v_retained := least(v_paid, v_penalty);
    v_released := round(v_paid - v_retained, 2);
    v_debt := round(greatest(0, v_penalty - v_paid), 2);
  else
    v_released := v_paid;
  end if;

  perform set_config('app.profe_cancel', '1', true);
  update public.reservations
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid,
      cancel_reason = nullif(trim(coalesce(p_reason, '')), ''), late_cancel = v_late,
      updated_by = v_uid, updated_at = now()
  where id = r.id;

  -- Se libera mientras alcance el monto liberable; lo retenido queda sin liberar (es la penalidad).
  v_budget := v_released;
  for p in select id, amount from public.payments where reservation_id = r.id and not released order by created_at loop
    exit when v_budget <= 0;
    if p.amount > 0 and p.amount <= v_budget then
      update public.payments set released = true where id = p.id;
      v_budget := round(v_budget - p.amount, 2);
      v_released_actual := round(v_released_actual + p.amount, 2);
    end if;
  end loop;

  -- Saldo a favor: lo liberado suma y la deuda resta, sobre el teléfono del turno.
  v_phone := trim(coalesce(r.phone, ''));
  if v_phone <> '' and round(v_released_actual - v_debt, 2) <> 0 then
    insert into public.credit_balances (club_id, customer_phone, amount)
    values (r.club_id, v_phone, round(v_released_actual - v_debt, 2))
    on conflict (club_id, customer_phone)
    do update set amount = public.credit_balances.amount + excluded.amount, updated_at = now();
  end if;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (
    r.club_id, v_uid, 'reservation', r.id, 'reservation.cancelled',
    jsonb_strip_nulls(jsonb_build_object(
      'late', v_late,
      'penalty', case when v_late then v_penalty end,
      'retained', case when v_retained > 0 then v_retained end,
      'released', case when v_released_actual > 0 then v_released_actual end,
      'debt', case when v_debt > 0 then v_debt end,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'by_profe', true
    ))
  );

  return jsonb_build_object(
    'late', v_late, 'penalty', v_penalty, 'retained', v_retained,
    'released', v_released_actual, 'debt', v_debt
  );
end;
$$;

revoke execute on function public.cancel_own_profe_reservation(uuid, text, boolean) from public, anon;
grant execute on function public.cancel_own_profe_reservation(uuid, text, boolean) to authenticated;
