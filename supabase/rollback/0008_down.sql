-- Vuelta atrás de 0008_reservation_types_and_socios.sql (solo emergencia, a mano:
-- `psql -1 -f` o SQL Editor). No está en `migrations/` para que `db push` no lo aplique.
-- Después: `supabase migration repair --status reverted 0008` y desplegar el código anterior.
--
-- Se pierden: socios, personas de los turnos, turnos fijos (las fechas ya generadas
-- quedan como turnos comunes), precios por tipo de cancha (vuelven a regir los de
-- cada cancha, que 0008 no tocó), el valor fijado en cada turno, la duración de
-- torneo y los colores de profes. Los turnos de profe y torneo quedan como turnos comunes.

drop function if exists public.ensure_series_until(uuid, date);

drop table if exists public.reservation_participants;

drop index if exists public.reservations_series_date_idx;
alter table public.reservations drop constraint if exists reservations_profe_check;
alter table public.reservations
  drop column if exists series_id,
  drop column if exists price,
  drop column if exists profe_user_id,
  drop column if exists kind;

drop table if exists public.reservation_series;
drop table if exists public.sport_prices;
drop table if exists public.socios;

alter table public.settings drop column if exists tournament_duration_minutes;
alter table public.memberships drop column if exists color;

-- create_club como en 0007 (sin precios por deporte).
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
