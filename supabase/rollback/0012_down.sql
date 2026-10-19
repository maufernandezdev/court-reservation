-- Vuelta atrás de 0012_players_and_schema_cleanup.sql. Restaura los nombres `socios` / `socio_id`, la
-- versión de ensure_series_until de 0010 y las columnas de courts con sus valores por defecto (los
-- precios y la seña que tenían se pierden: ya estaban en sport_prices).

alter table public.courts
  add column price_per_hour numeric(10,2) not null default 0,
  add column deposit_enabled boolean not null default false,
  add column deposit_type text not null default 'percent',
  add column deposit_value numeric(10,2) not null default 0;

alter table public.courts
  add constraint courts_deposit_type_check check (deposit_type in ('fixed', 'percent'));
alter table public.courts
  add constraint courts_deposit_value_check check (deposit_value >= 0);

update public.audit_log
set action = replace(action, 'player.', 'socio.'),
    entity = case when entity = 'player' then 'socio' else entity end
where action like 'player.%' or entity = 'player';

update public.reservation_series
set participants = (
  select coalesce(jsonb_agg(
    case when p ? 'player_id'
      then (p - 'player_id') || jsonb_build_object('socio_id', p -> 'player_id')
      else p end
    order by ord), '[]'::jsonb)
  from jsonb_array_elements(participants) with ordinality as t(p, ord)
)
where participants::text like '%player_id%';

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

alter table public.reservation_participants rename column player_id to socio_id;
alter index public.reservation_participants_player_idx rename to reservation_participants_socio_idx;

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where conname like '%player%' and connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s rename constraint %I to %I', c.tbl, c.conname, replace(c.conname, 'player', 'socio'));
  end loop;
end $$;

alter policy "players_select_member" on public.players rename to "socios_select_member";
alter policy "players_insert_staff" on public.players rename to "socios_insert_staff";
alter policy "players_update_staff" on public.players rename to "socios_update_staff";

alter index public.players_club_dni_idx rename to socios_club_dni_idx;
alter index public.players_club_name_idx rename to socios_club_name_idx;

alter table public.players rename to socios;
