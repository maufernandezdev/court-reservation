-- Días especiales (feriados) — openspec/changes/club-feedback-2026-11, fase 1 (#19 y #20).
-- 1) `club_special_days`: una fila por club y fecha, con nombre ("Feriado"), si el club cierra y una
--    tarifa por hora opcional para todo el día.
-- 2) Trigger en `reservations`: con tarifa del día, los turnos de precio de lista valen esa tarifa
--    por hora; si el club cierra, solo el admin carga turnos ese día y las fechas de fijos que se
--    generen para ese día nacen canceladas.
-- 3) `apply_special_day`: guarda el día y, si se pide, cancela los turnos de ese día (todos o solo
--    los fijos) en término: sin penalidad, lo cobrado se libera como saldo a favor. Esas
--    cancelaciones quedan marcadas (`special_day_cancel`) para no contarlas como cancelaciones del
--    jugador.
-- 4) `remove_special_day`: quita el día especial (los turnos cancelados no se restauran).

create table if not exists public.club_special_days (
  club_id uuid not null references public.clubs(id) on delete cascade,
  date date not null,
  label text not null default 'Feriado' check (char_length(trim(label)) between 1 and 60),
  closed boolean not null default false,
  hourly_price numeric(10,2) check (hourly_price is null or hourly_price >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, date)
);

alter table public.club_special_days enable row level security;

drop policy if exists "special_days_select_member" on public.club_special_days;
create policy "special_days_select_member" on public.club_special_days
  for select to authenticated
  using (public.is_member(club_id));

-- Las escrituras van solo por las funciones de abajo (admin).
revoke all on table public.club_special_days from anon;
revoke insert, update, delete on table public.club_special_days from authenticated;
grant select on table public.club_special_days to authenticated;

drop trigger if exists special_days_subscription_writable on public.club_special_days;
create trigger special_days_subscription_writable
before insert or update or delete on public.club_special_days
for each row execute function public.enforce_subscription_writable();

alter table public.reservations
  add column if not exists special_day_cancel boolean not null default false;

-- Precio y cierre del día especial al cargar o mover un turno.
create or replace function public.apply_special_day_to_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day public.club_special_days%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.date = old.date
     and new.duration_minutes = old.duration_minutes
     and new.pricing_mode = old.pricing_mode then
    return new;
  end if;

  select * into v_day from public.club_special_days where club_id = new.club_id and date = new.date;
  if not found then
    return new;
  end if;

  if v_day.closed and tg_op = 'INSERT' and new.status = 'active' then
    if new.series_id is not null then
      -- Fecha de un fijo que cae en un día cerrado: se genera cancelada.
      new.status := 'cancelled';
      new.cancelled_at := now();
      new.cancel_reason := v_day.label;
      new.special_day_cancel := true;
      return new;
    end if;
    if not public.is_admin(new.club_id) then
      raise exception 'El club está cerrado ese día (%). Solo el administrador puede cargar turnos.', v_day.label
        using errcode = 'P0001';
    end if;
  end if;

  if v_day.hourly_price is not null and new.pricing_mode = 'lista' then
    new.price := round(v_day.hourly_price * new.duration_minutes / 60.0, 2);
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_special_day on public.reservations;
create trigger reservations_special_day
before insert or update of date, duration_minutes, pricing_mode on public.reservations
for each row execute function public.apply_special_day_to_reservation();

create or replace function public.apply_special_day(
  p_club_id uuid,
  p_date date,
  p_label text,
  p_closed boolean,
  p_hourly_price numeric,
  p_cancel text -- 'none' | 'fijos' | 'todos'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text := trim(coalesce(p_label, ''));
  r record;
  v_released numeric;
  v_people jsonb := '[]'::jsonb;
  v_count int := 0;
  v_repriced int := 0;
begin
  if not public.is_admin(p_club_id) then
    raise exception 'Solo el administrador marca feriados.' using errcode = '42501';
  end if;
  if p_date is null or p_date < public.today_ar() then
    raise exception 'Elegí una fecha de hoy en adelante.' using errcode = '22023';
  end if;
  if char_length(v_label) not between 1 and 60 then
    raise exception 'El nombre del día es obligatorio (hasta 60 caracteres).' using errcode = '22023';
  end if;
  if p_hourly_price is not null and p_hourly_price < 0 then
    raise exception 'La tarifa no puede ser negativa.' using errcode = '22023';
  end if;
  if coalesce(p_cancel, 'none') not in ('none', 'fijos', 'todos') then
    raise exception 'Opción de cancelación no válida.' using errcode = '22023';
  end if;

  insert into public.club_special_days (club_id, date, label, closed, hourly_price, created_by)
  values (p_club_id, p_date, v_label, coalesce(p_closed, false), p_hourly_price, v_uid)
  on conflict (club_id, date) do update set
    label = excluded.label,
    closed = excluded.closed,
    hourly_price = excluded.hourly_price,
    updated_at = now();

  -- Tarifa del día: turnos de lista que todavía no tienen cobros.
  if p_hourly_price is not null then
    update public.reservations res
    set price = round(p_hourly_price * res.duration_minutes / 60.0, 2), updated_by = v_uid
    where res.club_id = p_club_id
      and res.date = p_date
      and res.status in ('active', 'pending_approval')
      and res.pricing_mode = 'lista'
      and not exists (select 1 from public.payments p where p.reservation_id = res.id);
    get diagnostics v_repriced = row_count;
  end if;

  if coalesce(p_cancel, 'none') <> 'none' then
    for r in
      select res.id, res.customer_name, res.phone, res.time, res.series_id, c.name as court_name
      from public.reservations res
      join public.courts c on c.id = res.court_id
      where res.club_id = p_club_id
        and res.date = p_date
        and res.status in ('active', 'pending_approval')
        and (p_cancel = 'todos' or res.series_id is not null)
        -- Los turnos que ya empezaron no se cancelan (si el feriado se marca el mismo día).
        and (res.date + res.time::time) > (now() at time zone 'America/Argentina/Buenos_Aires')
      order by res.time, c.name
    loop
      update public.reservations
      set status = 'cancelled',
          cancelled_at = now(),
          cancelled_by = v_uid,
          cancel_reason = v_label,
          late_cancel = false,
          special_day_cancel = true,
          updated_by = v_uid
      where id = r.id;

      -- En término: todo lo cobrado se libera como saldo a favor.
      with rel as (
        update public.payments set released = true
        where reservation_id = r.id and not released
        returning amount
      )
      select coalesce(sum(amount), 0) into v_released from rel;

      if v_released > 0 and trim(coalesce(r.phone, '')) <> '' then
        insert into public.credit_balances (club_id, customer_phone, amount)
        values (p_club_id, trim(r.phone), v_released)
        on conflict (club_id, customer_phone)
        do update set amount = public.credit_balances.amount + v_released, updated_at = now();
      end if;

      insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
      values (p_club_id, v_uid, 'reservation', r.id, 'reservation.cancelled',
        jsonb_build_object('late', false, 'reason', v_label, 'special_day', true,
          'released', nullif(v_released, 0)));

      v_count := v_count + 1;
      v_people := v_people || jsonb_build_object(
        'name', r.customer_name, 'phone', r.phone, 'time', r.time, 'court', r.court_name,
        'fixed', r.series_id is not null, 'released', v_released);
    end loop;
  end if;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (p_club_id, v_uid, 'club', p_club_id, 'special_day.applied',
    jsonb_build_object('date', p_date, 'label', v_label, 'closed', coalesce(p_closed, false),
      'hourly_price', p_hourly_price, 'cancel', coalesce(p_cancel, 'none'), 'cancelled', v_count,
      'repriced', v_repriced));

  return jsonb_build_object('cancelled', v_count, 'repriced', v_repriced, 'people', v_people);
end;
$$;

create or replace function public.remove_special_day(p_club_id uuid, p_date date) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_club_id) then
    raise exception 'Solo el administrador quita feriados.' using errcode = '42501';
  end if;
  delete from public.club_special_days where club_id = p_club_id and date = p_date;
  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (p_club_id, auth.uid(), 'club', p_club_id, 'special_day.removed', jsonb_build_object('date', p_date));
end;
$$;

revoke all on function public.apply_special_day(uuid, date, text, boolean, numeric, text) from public, anon;
grant execute on function public.apply_special_day(uuid, date, text, boolean, numeric, text) to authenticated;
revoke all on function public.remove_special_day(uuid, date) from public, anon;
grant execute on function public.remove_special_day(uuid, date) to authenticated;
