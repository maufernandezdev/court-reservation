-- Precio de noche (costo de la luz): cada tipo de cancha suma un precio de noche para
-- público y para profes, y el club tiene un horario único a partir del cual rige.
-- El precio se elige por la hora de inicio del turno: antes del horario de noche, todo
-- a precio de día; a esa hora o después, todo a precio de noche.
-- Migración aditiva: las columnas nuevas arrancan con el precio de día, así ningún valor
-- cambia hasta que el admin cargue el de noche.
-- `supabase db push` corre cada migración dentro de una transacción.

-- ---------------------------------------------------------------------------
-- 1. Precio de noche por tipo de cancha
-- ---------------------------------------------------------------------------
alter table public.sport_prices
  add column public_night_price_per_hour numeric(10,2) not null default 0
    check (public_night_price_per_hour >= 0),
  add column profe_night_price_per_hour numeric(10,2) not null default 0
    check (profe_night_price_per_hour >= 0);

update public.sport_prices
set public_night_price_per_hour = public_price_per_hour,
    profe_night_price_per_hour = profe_price_per_hour;

-- ---------------------------------------------------------------------------
-- 2. Horario de inicio de la noche (uno por club)
-- ---------------------------------------------------------------------------
alter table public.settings
  add column night_starts_at time not null default '18:00';

-- ---------------------------------------------------------------------------
-- 3. Turnos fijos: el valor de cada fecha sale del precio según la hora de inicio de la serie
-- ---------------------------------------------------------------------------
-- Igual que la versión de 0008, salvo el cálculo de v_price. Todas las fechas de una serie
-- tienen la misma hora de inicio, así que todas caen del mismo lado del horario de noche.
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
  v_night_starts time;
  v_is_night boolean;
  v_price numeric;
  v_reservation_id uuid;
  v_person record;
begin
  if not public.is_member(p_club_id) then
    raise exception 'No sos miembro de este club.' using errcode = '42501';
  end if;

  select coalesce(
    (select st.night_starts_at from public.settings st where st.club_id = p_club_id),
    time '18:00'
  ) into v_night_starts;

  for s in
    select * from public.reservation_series rs
    where rs.club_id = p_club_id
      and rs.generated_until < least(p_until, coalesce(rs.ends_on, p_until))
    for update skip locked
  loop
    v_target := least(p_until, coalesce(s.ends_on, p_until));
    v_start := extract(hour from s.start_time::time) * 60 + extract(minute from s.start_time::time);
    v_is_night := s.start_time::time >= v_night_starts;

    select round(
      case
        when s.kind = 'profe' and v_is_night then sp.profe_night_price_per_hour
        when s.kind = 'profe' then sp.profe_price_per_hour
        when v_is_night then sp.public_night_price_per_hour
        else sp.public_price_per_hour
      end * s.duration_minutes / 60.0, 2)
    into v_price
    from public.courts c
    join public.sport_prices sp on sp.club_id = c.club_id and sp.sport = c.type
    where c.id = s.court_id;

    v_day := greatest(s.generated_until + 1, s.starts_on);
    -- Primer día de la semana de la serie desde v_day.
    v_day := v_day + ((s.weekday - extract(dow from v_day)::int + 7) % 7);

    while v_day <= v_target loop
      if exists (
        select 1 from public.reservations r
        where r.court_id = s.court_id
          and r.date = v_day
          and r.status = 'active'
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
          kind, profe_user_id, price, series_id, created_by, updated_by
        )
        values (
          s.club_id, s.court_id, v_day, s.start_time, s.duration_minutes, s.customer_name, s.phone,
          s.kind, s.profe_user_id, coalesce(v_price, 0), s.id, s.created_by, s.created_by
        )
        on conflict do nothing
        returning id into v_reservation_id;

        if v_reservation_id is not null then
          for v_person in
            select ordinality::smallint as position, value ->> 'name' as name,
                   nullif(value ->> 'socio_id', '')::uuid as socio_id
            from jsonb_array_elements(s.participants) with ordinality
          loop
            insert into public.reservation_participants (club_id, reservation_id, position, socio_id, name)
            values (s.club_id, v_reservation_id, v_person.position, v_person.socio_id, v_person.name);
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

revoke execute on function public.ensure_series_until(uuid, date) from public, anon;
grant execute on function public.ensure_series_until(uuid, date) to authenticated;
