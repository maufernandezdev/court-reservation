-- Vuelta atrás de 0013_club_subscriptions.sql. Se pierden los planes, las suscripciones y el historial
-- de pagos de suscripción. `create_club` y `ensure_series_until` vuelven a sus versiones de 0008 y 0012.

do $$
declare
  t text;
begin
  foreach t in array array[
    'courts', 'reservations', 'reservation_participants', 'reservation_series', 'payments',
    'credit_balances', 'settings', 'sport_prices', 'players', 'memberships', 'club_invitations'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_subscription_writable', t);
  end loop;
end $$;

drop trigger if exists courts_subscription_writable_limit on public.courts;
drop function if exists public.enforce_subscription_writable();
drop function if exists public.enforce_court_limit();

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

revoke execute on function public.ensure_series_until(uuid, date) from public, anon;
grant execute on function public.ensure_series_until(uuid, date) to authenticated;


create or replace function public.create_club(p_name text, p_city text, p_courts jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_city text := trim(coalesce(p_city, ''));
  v_club_id uuid;
  v_email text;
  v_full_name text;
  v_type text;
  v_count int;
  v_total int := 0;
  v_prefix text;
  i int;
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 80 then
    raise exception 'El nombre del club es obligatorio (hasta 80 caracteres).' using errcode = '22023';
  end if;

  if char_length(v_city) > 80 then
    raise exception 'La ciudad puede tener hasta 80 caracteres.' using errcode = '22023';
  end if;

  if p_courts is null or jsonb_typeof(p_courts) <> 'object' then
    raise exception 'Indicá cuántas canchas tenés de cada deporte.' using errcode = '22023';
  end if;

  for v_type in select jsonb_object_keys(p_courts) loop
    if v_type not in ('tenis', 'padel', 'futbol') then
      raise exception 'Deporte no válido: %', v_type using errcode = '22023';
    end if;
    if jsonb_typeof(p_courts -> v_type) <> 'number' then
      raise exception 'La cantidad de canchas tiene que ser un número.' using errcode = '22023';
    end if;
    v_count := (p_courts ->> v_type)::numeric;
    if v_count::numeric <> (p_courts ->> v_type)::numeric or v_count not between 0 and 20 then
      raise exception 'Cada deporte admite entre 0 y 20 canchas.' using errcode = '22023';
    end if;
    v_total := v_total + v_count;
  end loop;

  if v_total < 1 then
    raise exception 'El club necesita al menos una cancha.' using errcode = '22023';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', '')
  into v_email, v_full_name
  from auth.users where id = v_uid;

  insert into public.clubs (name, city, created_by)
  values (v_name, v_city, v_uid)
  returning id into v_club_id;

  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v_club_id, v_uid, 'admin', v_full_name, lower(coalesce(v_email, '')));

  insert into public.settings (club_id) values (v_club_id);

  -- Mismo orden y nombres que la vista previa del alta: tenis, pádel, fútbol.
  foreach v_type in array array['tenis', 'padel', 'futbol'] loop
    v_count := coalesce((p_courts ->> v_type)::int, 0);
    if v_count > 0 then
      insert into public.sport_prices (club_id, sport) values (v_club_id, v_type);
    end if;
    v_prefix := case v_type when 'tenis' then 'Cancha' when 'padel' then 'Pádel' else 'Fútbol' end;
    for i in 1..v_count loop
      insert into public.courts (club_id, name, type)
      values (v_club_id, v_prefix || ' ' || i, v_type);
    end loop;
  end loop;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (
    v_club_id, v_uid, 'club', v_club_id, 'club.created',
    jsonb_build_object('name', v_name, 'city', v_city, 'courts', p_courts)
  );

  return v_club_id;
end;
$$;

drop function if exists public.register_subscription_payment(uuid, numeric, text, text, text, text, text, timestamptz, jsonb);
drop function if exists public.club_is_read_only(uuid);
drop function if exists public.club_subscription_status(uuid);
drop function if exists public.club_effective_state(uuid);
drop function if exists public.club_subscription_info(uuid, date);
drop function if exists public.today_ar();

drop table if exists public.subscription_payments;
drop table if exists public.club_subscriptions;
drop table if exists public.plans;
