-- Socios, tipos de turno (estándar, profe, torneo), personas del turno, turnos fijos
-- semanales y precios por tipo de cancha (público y profe).
-- Migración aditiva: solo crea tablas y columnas con defaults compatibles, así el
-- código anterior sigue funcionando con esta migración aplicada.

-- ---------------------------------------------------------------------------
-- 1. Socios del club (sin cuota). Baja lógica para no romper turnos pasados.
-- ---------------------------------------------------------------------------
create table public.socios (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  dni text not null default '' check (char_length(dni) <= 20),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

alter table public.socios enable row level security;

-- DNI único entre los socios activos del club (si se cargó).
create unique index socios_club_dni_idx
  on public.socios (club_id, dni)
  where dni <> '' and deleted_at is null;
create index socios_club_name_idx on public.socios (club_id, lower(full_name));

-- Todos los miembros los leen (el profe los busca al reservar); el staff los gestiona.
create policy "socios_select_member" on public.socios
  for select to authenticated
  using (is_member(club_id));

create policy "socios_insert_staff" on public.socios
  for insert to authenticated
  with check (is_staff(club_id));

create policy "socios_update_staff" on public.socios
  for update to authenticated
  using (is_staff(club_id))
  with check (is_staff(club_id));

-- ---------------------------------------------------------------------------
-- 2. Precios por tipo de cancha (público y profe) y seña.
-- ---------------------------------------------------------------------------
create table public.sport_prices (
  club_id uuid not null references public.clubs(id) on delete cascade,
  sport text not null check (sport in ('tenis', 'padel', 'futbol')),
  public_price_per_hour numeric(10,2) not null default 0 check (public_price_per_hour >= 0),
  profe_price_per_hour numeric(10,2) not null default 0 check (profe_price_per_hour >= 0),
  deposit_enabled boolean not null default false,
  deposit_type text not null default 'percent' check (deposit_type in ('fixed', 'percent')),
  deposit_value numeric(10,2) not null default 0 check (deposit_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (club_id, sport)
);

alter table public.sport_prices enable row level security;

create policy "sport_prices_select_member" on public.sport_prices
  for select to authenticated
  using (is_member(club_id));

create policy "sport_prices_insert_admin" on public.sport_prices
  for insert to authenticated
  with check (is_admin(club_id));

create policy "sport_prices_update_admin" on public.sport_prices
  for update to authenticated
  using (is_admin(club_id))
  with check (is_admin(club_id));

-- Backfill: por club y deporte, precio y seña de la cancha activa más cara; profe = público.
insert into public.sport_prices (
  club_id, sport, public_price_per_hour, profe_price_per_hour,
  deposit_enabled, deposit_type, deposit_value
)
select distinct on (club_id, type)
  club_id, type, price_per_hour, price_per_hour,
  deposit_enabled, deposit_type, deposit_value
from public.courts
where active
order by club_id, type, price_per_hour desc, created_at
on conflict (club_id, sport) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Turnos fijos semanales (se materializan como turnos comunes).
-- ---------------------------------------------------------------------------
create table public.reservation_series (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo (extract dow)
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes int not null check (duration_minutes between 30 and 360),
  kind text not null check (kind in ('standard', 'profe')),
  profe_user_id uuid references auth.users(id),
  customer_name text not null check (char_length(trim(customer_name)) > 0),
  phone text not null default '',
  -- Personas del turno: [{ "name": "...", "socio_id": "uuid" | null }, ...]
  participants jsonb not null default '[]'::jsonb,
  starts_on date not null,
  ends_on date,
  generated_until date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check ((kind = 'profe') = (profe_user_id is not null))
);

alter table public.reservation_series enable row level security;

create index reservation_series_club_idx on public.reservation_series (club_id);

create policy "series_select_member" on public.reservation_series
  for select to authenticated
  using (is_member(club_id));

-- El staff crea y da de baja cualquier fijo; el profe, solo los propios.
create policy "series_insert_staff_or_own" on public.reservation_series
  for insert to authenticated
  with check (
    is_staff(club_id)
    or (is_member(club_id) and kind = 'profe' and profe_user_id = auth.uid())
  );

create policy "series_update_staff_or_own" on public.reservation_series
  for update to authenticated
  using (is_staff(club_id) or (is_member(club_id) and profe_user_id = auth.uid()))
  with check (is_staff(club_id) or (is_member(club_id) and profe_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Tipo, profe, precio fijado y serie en cada turno.
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column kind text not null default 'standard'
    check (kind in ('standard', 'profe', 'torneo')),
  add column profe_user_id uuid references auth.users(id),
  add column price numeric(10,2) not null default 0 check (price >= 0),
  add column series_id uuid references public.reservation_series(id) on delete set null;

alter table public.reservations
  add constraint reservations_profe_check check ((kind = 'profe') = (profe_user_id is not null));

-- Una sola fecha por serie (aunque esté cancelada: liberar una fecha no la vuelve a generar).
create unique index reservations_series_date_idx
  on public.reservations (series_id, date)
  where series_id is not null;

-- Backfill del valor que tenía cada turno (precio de la cancha × duración), sin tocar updated_at.
alter table public.reservations disable trigger reservations_set_updated_at;
update public.reservations r
set price = round(c.price_per_hour * r.duration_minutes / 60.0, 2)
from public.courts c
where c.id = r.court_id;
alter table public.reservations enable trigger reservations_set_updated_at;

-- ---------------------------------------------------------------------------
-- 5. Personas del turno (1 a 4; la 1 es quien reserva).
-- ---------------------------------------------------------------------------
create table public.reservation_participants (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  socio_id uuid references public.socios(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (reservation_id, position)
);

alter table public.reservation_participants enable row level security;

create index reservation_participants_reservation_idx
  on public.reservation_participants (reservation_id);
create index reservation_participants_socio_idx
  on public.reservation_participants (socio_id) where socio_id is not null;

-- Igual que los turnos: cualquier miembro (también el profe) carga las personas.
create policy "participants_select_member" on public.reservation_participants
  for select to authenticated
  using (is_member(club_id));

create policy "participants_insert_member" on public.reservation_participants
  for insert to authenticated
  with check (is_member(club_id));

create policy "participants_update_member" on public.reservation_participants
  for update to authenticated
  using (is_member(club_id))
  with check (is_member(club_id));

create policy "participants_delete_member" on public.reservation_participants
  for delete to authenticated
  using (is_member(club_id));

-- Backfill: quien reservó cada turno existente queda como persona 1.
insert into public.reservation_participants (club_id, reservation_id, position, name)
select club_id, id, 1, customer_name
from public.reservations
on conflict (reservation_id, position) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Duración estándar de torneo y color de cada profe.
-- ---------------------------------------------------------------------------
alter table public.settings
  add column tournament_duration_minutes int not null default 90
    check (tournament_duration_minutes between 30 and 360 and tournament_duration_minutes % 30 = 0);

alter table public.memberships
  add column color text check (color ~ '^#[0-9A-Fa-f]{6}$');

-- Paleta de profes (misma que lib/profe-colors.ts): a cada profesor existente, un color por orden.
with palette(idx, color) as (
  values (1, '#B4235A'), (2, '#7A3FB8'), (3, '#1F7A4D'), (4, '#C2410C'),
         (5, '#0F766E'), (6, '#A16207'), (7, '#6D4C41'), (8, '#475569')
),
profes as (
  select id, ((row_number() over (partition by club_id order by created_at) - 1) % 8) + 1 as idx
  from public.memberships
  where role = 'profesor' and color is null
)
update public.memberships m
set color = palette.color
from profes join palette using (idx)
where m.id = profes.id;

-- ---------------------------------------------------------------------------
-- 7. Alta del club: también crea los precios de los deportes elegidos.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 8. Materialización de turnos fijos hasta una fecha (idempotente).
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: respeta el RLS de quien consulta (tiene que ser miembro del club).
-- Para cada serie activa genera las fechas que faltan hasta p_until con el precio
-- vigente, saltea las que se superponen con un turno activo y avanza generated_until.
-- Devuelve las fechas salteadas (para avisar al crear la serie).
create function public.ensure_series_until(p_club_id uuid, p_until date)
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

  for s in
    select * from public.reservation_series rs
    where rs.club_id = p_club_id
      and rs.generated_until < least(p_until, coalesce(rs.ends_on, p_until))
    for update skip locked
  loop
    v_target := least(p_until, coalesce(s.ends_on, p_until));
    v_start := extract(hour from s.start_time::time) * 60 + extract(minute from s.start_time::time);

    select round(
      case when s.kind = 'profe' then sp.profe_price_per_hour else sp.public_price_per_hour end
      * s.duration_minutes / 60.0, 2)
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
