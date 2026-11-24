-- Precio especial en turnos y fijos (plan: openspec/changes/add-special-pricing/plan.md).
-- Modos de precio: 'lista' (como siempre), 'sin_cargo' (ocupa la cancha, $0, nace pagado),
-- 'por_persona' (cuenta abierta: el precio es lo cobrado, cobros de a uno o uno único en varios
-- medios, el admin la cierra y la puede reabrir) y 'monto_fijo' (un total a mano).
-- Solo el admin pone o cambia un precio especial. Los fijos guardan el modo y la generación de
-- fechas lo hereda (la puede disparar cualquier miembro al abrir la planilla).

-- 1) Columnas ----------------------------------------------------------------------------------
alter table public.reservations
  add column pricing_mode text not null default 'lista'
    check (pricing_mode in ('lista', 'sin_cargo', 'por_persona', 'monto_fijo')),
  add column unit_price numeric(10,2) check (unit_price is null or unit_price > 0),
  add column expected_people smallint check (expected_people is null or expected_people between 1 and 200),
  add column closed_at timestamptz,
  add column closed_by uuid references auth.users(id);

alter table public.reservations
  add constraint reservations_pricing_check check (
    (pricing_mode <> 'por_persona' or unit_price is not null)
    and (pricing_mode <> 'sin_cargo' or price = 0)
    and (pricing_mode = 'por_persona' or closed_at is null)
  );

alter table public.reservation_series
  add column pricing_mode text not null default 'lista'
    check (pricing_mode in ('lista', 'sin_cargo', 'por_persona', 'monto_fijo')),
  add column custom_price numeric(10,2) check (custom_price is null or custom_price >= 0),
  add column unit_price numeric(10,2) check (unit_price is null or unit_price > 0),
  add column expected_people smallint check (expected_people is null or expected_people between 1 and 200);

alter table public.reservation_series
  add constraint reservation_series_pricing_check check (
    (pricing_mode <> 'por_persona' or unit_price is not null)
    and (pricing_mode <> 'monto_fijo' or custom_price is not null)
  );

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments
  add constraint payments_kind_check check (kind in ('seña', 'total', 'saldo', 'persona')),
  add column payer_name text check (payer_name is null or char_length(payer_name) <= 120);

-- 2) Precio de lista de un turno (lo que hacía ensure_series_until en línea) --------------------
create or replace function public.list_price_for(
  p_court_id uuid,
  p_kind text,
  p_start_time text,
  p_duration_minutes int
) returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(round(
    case
      when p_kind = 'profe' and p_start_time::time >= coalesce(st.night_starts_at, time '18:00')
        then coalesce(nullif(sp.profe_night_price_per_hour, 0), sp.profe_price_per_hour)
      when p_kind = 'profe' then sp.profe_price_per_hour
      when p_start_time::time >= coalesce(st.night_starts_at, time '18:00')
        then coalesce(nullif(sp.public_night_price_per_hour, 0), sp.public_price_per_hour)
      else sp.public_price_per_hour
    end * p_duration_minutes / 60.0, 2), 0)
  from public.courts c
  join public.sport_prices sp on sp.club_id = c.club_id and sp.sport = c.type
  left join public.settings st on st.club_id = c.club_id
  where c.id = p_court_id;
$$;

-- 3) Solo el admin pone precio especial --------------------------------------------------------
create or replace function public.enforce_special_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(new.club_id) then
    return new;
  end if;

  if tg_table_name = 'reservation_series' then
    if (tg_op = 'INSERT' and new.pricing_mode <> 'lista')
       or (tg_op = 'UPDATE' and (
         new.pricing_mode is distinct from old.pricing_mode
         or new.custom_price is distinct from old.custom_price
         or new.unit_price is distinct from old.unit_price
         or new.expected_people is distinct from old.expected_people)) then
      raise exception 'Solo el administrador pone precios especiales.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- reservations
  if tg_op = 'INSERT' then
    if new.pricing_mode = 'lista' then
      return new;
    end if;
    -- Fechas que genera un fijo especial: heredan el modo del fijo.
    if new.series_id is not null and exists (
      select 1 from public.reservation_series s
      where s.id = new.series_id
        and s.pricing_mode = new.pricing_mode
        and s.unit_price is not distinct from new.unit_price
        and (new.pricing_mode <> 'monto_fijo' or s.custom_price = new.price)
    ) then
      return new;
    end if;
    raise exception 'Solo el administrador pone precios especiales.' using errcode = '42501';
  end if;

  if new.pricing_mode is distinct from old.pricing_mode
     or new.unit_price is distinct from old.unit_price
     or new.expected_people is distinct from old.expected_people
     or new.closed_at is distinct from old.closed_at
     or (old.pricing_mode <> 'lista' and new.price is distinct from old.price) then
    raise exception 'Solo el administrador cambia un precio especial.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reservations_enforce_special_pricing
  before insert or update on public.reservations
  for each row execute function public.enforce_special_pricing();

create trigger reservation_series_enforce_special_pricing
  before insert or update on public.reservation_series
  for each row execute function public.enforce_special_pricing();

-- 4) Generación de fechas de los fijos con su modo de precio -----------------------------------
create or replace function public.ensure_series_until(p_club_id uuid, p_until date)
returns table (series_id uuid, skipped_date date)
language plpgsql
set search_path = public
as $$
declare
  s public.reservation_series%rowtype;
  v_target date;
  v_day date;
  v_start int;
  v_price numeric;
  v_reservation_id uuid;
  v_person record;
begin
  if not public.is_member(p_club_id) then
    raise exception 'No sos miembro de este club.' using errcode = '42501';
  end if;

  -- El organizador de torneos no ve los turnos con precio: no puede revisar choques, no genera.
  if public.is_organizer(p_club_id) then
    return;
  end if;

  -- Club vencido (solo lectura): no se generan fechas nuevas, la planilla muestra lo ya cargado.
  if public.club_is_read_only(p_club_id) then
    return;
  end if;

  for s in
    select * from public.reservation_series rs
    where rs.club_id = p_club_id
      and rs.generated_until < least(p_until, coalesce(rs.ends_on, p_until))
    for update skip locked
  loop
    v_target := least(p_until, coalesce(s.ends_on, p_until));
    v_start := extract(hour from s.start_time::time) * 60 + extract(minute from s.start_time::time);

    v_price := case s.pricing_mode
      when 'sin_cargo' then 0
      when 'por_persona' then 0
      when 'monto_fijo' then s.custom_price
      else public.list_price_for(s.court_id, s.kind, s.start_time, s.duration_minutes)
    end;

    v_day := greatest(s.generated_until + 1, s.starts_on);
    -- Primer día de la semana de la serie desde v_day.
    v_day := v_day + ((s.weekday - extract(dow from v_day)::int + 7) % 7);

    while v_day <= v_target loop
      if exists (
        select 1 from public.reservations r
        where r.court_id = s.court_id
          and r.date = v_day
          and r.status in ('active', 'pending_approval')
          and (r.series_id is distinct from s.id)
          and (extract(hour from r.time::time) * 60 + extract(minute from r.time::time)) < v_start + s.duration_minutes
          and v_start < (extract(hour from r.time::time) * 60 + extract(minute from r.time::time)) + r.duration_minutes
      ) then
        series_id := s.id;
        skipped_date := v_day;
        return next;
      else
        v_reservation_id := null;
        insert into public.reservations (
          club_id, court_id, date, time, duration_minutes, customer_name, phone,
          kind, profe_user_id, price, series_id, created_by, updated_by,
          pricing_mode, unit_price, expected_people, payment_status
        )
        values (
          s.club_id, s.court_id, v_day, s.start_time, s.duration_minutes, s.customer_name, s.phone,
          s.kind, s.profe_user_id, coalesce(v_price, 0), s.id, s.created_by, s.created_by,
          s.pricing_mode,
          case when s.pricing_mode = 'por_persona' then s.unit_price end,
          case when s.pricing_mode = 'por_persona' then s.expected_people end,
          case when s.pricing_mode = 'sin_cargo' then 'pagada' else 'pendiente' end
        )
        on conflict do nothing
        returning id into v_reservation_id;

        if v_reservation_id is not null then
          for v_person in
            select ordinality::smallint as position, value ->> 'name' as name,
                   nullif(value ->> 'player_id', '')::uuid as player_id
            from jsonb_array_elements(s.participants) with ordinality
          loop
            insert into public.reservation_participants (club_id, reservation_id, position, player_id, name)
            values (s.club_id, v_reservation_id, v_person.position, v_person.player_id, v_person.name);
          end loop;
        end if;
      end if;

      v_day := v_day + 7;
    end loop;

    update public.reservation_series
    set generated_until = v_target
    where id = s.id;
  end loop;
end;
$$;

-- 5) Cuenta por persona: cobrar (de a uno o un cobro único en varios medios) y cerrar ----------
create or replace function public.register_person_payments(
  p_reservation_id uuid,
  p_lines jsonb,
  p_close boolean default false,
  p_people int default null
) returns table (collected numeric, closed boolean)
language plpgsql
set search_path = public
as $$
declare
  r public.reservations%rowtype;
  v_line jsonb;
  v_amount numeric;
  v_method text;
  v_name text;
  v_total numeric;
begin
  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'No se encontró el turno.' using errcode = 'P0002';
  end if;
  if not public.is_admin(r.club_id) then
    raise exception 'Solo el administrador cobra por persona.' using errcode = '42501';
  end if;
  if r.status <> 'active' then
    raise exception 'El turno no está activo.' using errcode = '22023';
  end if;
  if r.pricing_mode <> 'por_persona' then
    raise exception 'Este turno no se cobra por persona.' using errcode = '22023';
  end if;
  if r.closed_at is not null then
    raise exception 'La cuenta de este turno está cerrada: reabrila para cobrar.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'Cobros inválidos.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 and not coalesce(p_close, false) then
    raise exception 'Cargá al menos un cobro.' using errcode = '22023';
  end if;
  if p_people is not null and (p_people < 1 or p_people > 200) then
    raise exception 'Cantidad de personas inválida.' using errcode = '22023';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_amount := (v_line ->> 'amount')::numeric;
    v_method := v_line ->> 'method';
    v_name := nullif(btrim(coalesce(v_line ->> 'payer_name', '')), '');
    if v_amount is null or v_amount <= 0 then
      raise exception 'Cada cobro tiene que ser mayor a $0.' using errcode = '22023';
    end if;
    if v_method is null or v_method not in ('efectivo', 'mercado_pago') then
      raise exception 'Elegí efectivo o Mercado Pago.' using errcode = '22023';
    end if;
    if v_name is not null and char_length(v_name) > 120 then
      raise exception 'El nombre es demasiado largo.' using errcode = '22023';
    end if;
    insert into public.payments (club_id, reservation_id, kind, amount, method, payer_name, created_by)
    values (r.club_id, r.id, 'persona', round(v_amount, 2), v_method, v_name, auth.uid());
  end loop;

  select coalesce(sum(p.amount), 0) into v_total
  from public.payments p
  where p.reservation_id = r.id and not p.released;

  update public.reservations
  set price = v_total,
      closed_at = case when p_close then now() end,
      closed_by = case when p_close then auth.uid() end,
      payment_status = case when p_close then 'pagada' else 'pendiente' end,
      expected_people = case when p_close and p_people is not null then p_people else expected_people end,
      updated_by = auth.uid()
  where id = r.id;

  return query select v_total, coalesce(p_close, false);
end;
$$;

create or replace function public.reopen_person_reservation(p_reservation_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  r public.reservations%rowtype;
begin
  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'No se encontró el turno.' using errcode = 'P0002';
  end if;
  if not public.is_admin(r.club_id) then
    raise exception 'Solo el administrador reabre una cuenta.' using errcode = '42501';
  end if;
  if r.pricing_mode <> 'por_persona' or r.closed_at is null then
    raise exception 'Este turno no tiene una cuenta cerrada.' using errcode = '22023';
  end if;
  update public.reservations
  set closed_at = null, closed_by = null, payment_status = 'pendiente', updated_by = auth.uid()
  where id = r.id;
end;
$$;

-- 6) Cambiar el precio de un fijo: se aplica a sus turnos de hoy en adelante sin cobros ---------
create or replace function public.update_series_pricing(
  p_series_id uuid,
  p_mode text,
  p_custom_price numeric,
  p_unit_price numeric,
  p_expected_people int
) returns int
language plpgsql
set search_path = public
as $$
declare
  s public.reservation_series%rowtype;
  v_count int;
begin
  select * into s from public.reservation_series where id = p_series_id for update;
  if not found then
    raise exception 'No se encontró el fijo.' using errcode = 'P0002';
  end if;
  if not public.is_admin(s.club_id) then
    raise exception 'Solo el administrador cambia el precio de un fijo.' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('lista', 'sin_cargo', 'por_persona', 'monto_fijo') then
    raise exception 'Modo de precio inválido.' using errcode = '22023';
  end if;
  if p_mode = 'por_persona' and (p_unit_price is null or p_unit_price <= 0) then
    raise exception 'Poné el precio por persona.' using errcode = '22023';
  end if;
  if p_mode = 'monto_fijo' and (p_custom_price is null or p_custom_price < 0) then
    raise exception 'Poné el monto del turno.' using errcode = '22023';
  end if;

  update public.reservation_series
  set pricing_mode = p_mode,
      custom_price = case when p_mode = 'monto_fijo' then round(p_custom_price, 2) end,
      unit_price = case when p_mode = 'por_persona' then round(p_unit_price, 2) end,
      expected_people = case when p_mode = 'por_persona' then p_expected_people end
  where id = s.id;

  update public.reservations r
  set pricing_mode = p_mode,
      unit_price = case when p_mode = 'por_persona' then round(p_unit_price, 2) end,
      expected_people = case when p_mode = 'por_persona' then p_expected_people end,
      price = case p_mode
        when 'sin_cargo' then 0
        when 'por_persona' then 0
        when 'monto_fijo' then round(p_custom_price, 2)
        else public.list_price_for(r.court_id, r.kind, r.time, r.duration_minutes)
      end,
      payment_status = case when p_mode = 'sin_cargo' then 'pagada' else 'pendiente' end,
      closed_at = null,
      closed_by = null,
      updated_by = auth.uid()
  where r.series_id = s.id
    and r.status in ('active', 'pending_approval')
    and r.date >= public.today_ar()
    and not exists (select 1 from public.payments p where p.reservation_id = r.id and not p.released);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.register_person_payments(uuid, jsonb, boolean, int) from public, anon;
grant execute on function public.register_person_payments(uuid, jsonb, boolean, int) to authenticated;
revoke execute on function public.reopen_person_reservation(uuid) from public, anon;
grant execute on function public.reopen_person_reservation(uuid) to authenticated;
revoke execute on function public.update_series_pricing(uuid, text, numeric, numeric, int) from public, anon;
grant execute on function public.update_series_pricing(uuid, text, numeric, numeric, int) to authenticated;
revoke execute on function public.list_price_for(uuid, text, text, int) from public, anon;
grant execute on function public.list_price_for(uuid, text, text, int) to authenticated;

-- 7) La planilla lee de reservation_board: sumar las columnas nuevas (el precio por persona
--    se oculta igual que el precio a quien no ve montos).
create or replace view public.reservation_board as
select
  r.id, r.club_id, r.court_id, r.date, r.time, r.customer_name, r.phone, r.created_at,
  r.duration_minutes, r.status, r.payment_status, r.cancelled_at, r.cancelled_by,
  r.cancel_reason, r.late_cancel, r.created_by, r.updated_by, r.updated_at, r.kind,
  r.profe_user_id,
  case when public.sees_money(r.club_id) then r.price end as price,
  r.series_id, r.result_winner, r.result_score, r.result_updated_by, r.result_updated_at,
  r.approved_by, r.approved_at, r.rejected_by, r.rejected_at,
  r.pricing_mode,
  case when public.sees_money(r.club_id) then r.unit_price end as unit_price,
  r.expected_people, r.closed_at, r.closed_by
from public.reservations r
where public.is_member(r.club_id);
