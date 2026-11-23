-- 1) Horarios bloqueados (antes "horarios con confirmación").
--    Un operador, profe u organizador ya no puede cargar un turno en una franja de `approval_rules`:
--    la base lo rechaza con un mensaje para que hable con el admin, y el admin lo carga desde su panel.
--    Los turnos que ya estaban "por confirmar" siguen pudiendo confirmarse o rechazarse.
-- 2) Liquidación de profes: el profe le paga al club los turnos de profe de un período.
--    `settle_profe_reservations` cobra en una sola transacción el saldo de cada turno (cobro "total"
--    en la fecha de hoy, como cualquier cobro de Caja) y los deja pagados.

create or replace function public.enforce_reservation_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := public.is_admin(new.club_id);
  v_moved boolean;
begin
  -- Confirmar o rechazar los pedidos que quedaron de antes es del admin.
  if tg_op = 'UPDATE' and old.status = 'pending_approval' and new.status in ('active', 'rejected')
     and not v_is_admin then
    raise exception 'Solo el administrador confirma o rechaza los turnos pendientes.' using errcode = '42501';
  end if;
  if new.status = 'rejected' and (tg_op = 'INSERT' or old.status is distinct from 'rejected') and not v_is_admin then
    raise exception 'Solo el administrador rechaza turnos.' using errcode = '42501';
  end if;

  -- El admin reserva en horarios bloqueados; las fechas de los fijos se revisan al crear el fijo.
  if v_is_admin or new.series_id is not null or new.status <> 'active' then
    return new;
  end if;

  v_moved := tg_op = 'INSERT'
    or new.court_id is distinct from old.court_id
    or new.date is distinct from old.date
    or new.time is distinct from old.time
    or new.duration_minutes is distinct from old.duration_minutes
    or old.status <> 'active';

  if v_moved and public.requires_approval(new.club_id, new.court_id, new.date, new.time, new.duration_minutes) then
    raise exception 'Ese horario está bloqueado: comunicate con el administrador para reservarlo.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.settle_profe_reservations(
  p_club_id uuid,
  p_profe_user_id uuid,
  p_from date,
  p_to date,
  p_method text
) returns table (settled_count int, settled_amount numeric)
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_paid numeric;
  v_due numeric;
  v_count int := 0;
  v_total numeric := 0;
begin
  if not public.is_admin(p_club_id) then
    raise exception 'Solo el administrador registra liquidaciones de profes.' using errcode = '42501';
  end if;
  if p_method not in ('efectivo', 'mercado_pago') then
    raise exception 'Elegí efectivo o Mercado Pago.' using errcode = '22023';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;

  for r in
    select res.id, coalesce(res.price, 0) as price
    from public.reservations res
    where res.club_id = p_club_id
      and res.kind = 'profe'
      and res.profe_user_id = p_profe_user_id
      and res.status = 'active'
      and res.payment_status <> 'pagada'
      and res.date between p_from and p_to
    order by res.date, res.time
    for update
  loop
    select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
    where p.reservation_id = r.id and not p.released;

    v_due := greatest(0, r.price - v_paid);
    if v_due > 0 then
      insert into public.payments (club_id, reservation_id, kind, amount, method, created_by)
      values (p_club_id, r.id, 'total', v_due, p_method, auth.uid());
      v_total := v_total + v_due;
    end if;

    update public.reservations
    set payment_status = 'pagada', updated_by = auth.uid()
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  return query select v_count, v_total;
end;
$$;

revoke execute on function public.settle_profe_reservations(uuid, uuid, date, date, text) from public, anon;
grant execute on function public.settle_profe_reservations(uuid, uuid, date, date, text) to authenticated;
