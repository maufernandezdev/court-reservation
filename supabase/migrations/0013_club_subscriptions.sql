-- Suscripción de cada club al SaaS: planes, prueba gratis de 30 días, pagos mes a mes (listos para
-- Mercado Pago, sin integración todavía), estado calculado con fechas, límite de canchas por plan y
-- modo solo lectura cuando el club no paga. Nunca bloquea el acceso: solo las escrituras.
-- Se llama "suscripción" y no "membership" porque `memberships` ya son los roles del equipo.
-- Las fechas son `date` en horario de Buenos Aires; el último día de la prueba o del período está incluido.
-- `supabase db push` corre cada migración dentro de una transacción.

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table public.plans (
  code text primary key,
  name text not null,
  max_courts int check (max_courts is null or max_courts > 0), -- null = sin tope
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  yearly_price numeric(12,2) not null check (yearly_price >= 0),
  currency text not null default 'ARS',
  sort_order int not null unique
);

-- Anual = 12 meses con 10 % de descuento.
insert into public.plans (code, name, max_courts, monthly_price, yearly_price, sort_order) values
  ('inicial',   'Inicial',   3,    15000, 162000, 1),
  ('club',      'Club',      6,    25000, 270000, 2),
  ('gran_club', 'Gran Club', null, 35000, 378000, 3);

create table public.club_subscriptions (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  plan_code text not null references public.plans(code),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  status text not null default 'trial' check (status in ('trial', 'active', 'canceled')),
  trial_ends_on date not null,
  paid_until date,
  grace_days int not null default 5 check (grace_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  plan_code text not null references public.plans(code),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  period_start date not null,
  period_end date not null,
  method text not null default 'mercadopago' check (method in ('mercadopago')),
  status text not null check (status in ('approved', 'pending', 'rejected', 'refunded')),
  paid_at timestamptz not null default now(),
  -- Datos de Mercado Pago, ya previstos para el webhook.
  mp_payment_id text unique,
  mp_preapproval_id text,
  external_reference text,
  raw jsonb,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index subscription_payments_club_idx on public.subscription_payments (club_id, paid_at desc);

-- ---------------------------------------------------------------------------
-- 2. Permisos: lectura según el spec; sin políticas de escritura (solo service role)
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.club_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

create policy "plans_select_authenticated" on public.plans
  for select to authenticated using (true);

create policy "club_subscriptions_select_admin" on public.club_subscriptions
  for select to authenticated using (is_admin(club_id));

create policy "subscription_payments_select_admin" on public.subscription_payments
  for select to authenticated using (is_admin(club_id));

revoke all on public.plans, public.club_subscriptions, public.subscription_payments from anon;
revoke insert, update, delete, truncate on public.plans, public.club_subscriptions, public.subscription_payments from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Estado calculado
-- ---------------------------------------------------------------------------
create function public.today_ar() returns date
language sql stable
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- Todo lo que hay que saber de la suscripción de un club en una fecha (p_today permite simular fechas).
-- state: trial | active | grace | expired | none (club sin suscripción: no se restringe nada).
-- Un club `canceled` conserva el servicio hasta `paid_until` y después queda vencido, sin gracia.
create function public.club_subscription_info(p_club_id uuid, p_today date default public.today_ar())
returns jsonb
language plpgsql stable
security definer
set search_path = public
as $$
declare
  s public.club_subscriptions%rowtype;
  p public.plans%rowtype;
  v_end date;
  v_grace int;
  v_state text;
  v_courts int;
begin
  select * into s from public.club_subscriptions where club_id = p_club_id;
  if not found then
    return jsonb_build_object('state', 'none', 'can_write', true);
  end if;
  select * into p from public.plans where code = s.plan_code;

  v_end := case when s.status = 'trial' then s.trial_ends_on else coalesce(s.paid_until, s.trial_ends_on) end;
  v_grace := case when s.status = 'canceled' then 0 else s.grace_days end;
  v_state := case
    when p_today <= v_end then case when s.status = 'trial' then 'trial' else 'active' end
    when p_today <= v_end + v_grace then 'grace'
    else 'expired'
  end;

  select count(*) into v_courts from public.courts where club_id = p_club_id and active;

  return jsonb_build_object(
    'state', v_state,
    'status', s.status,
    'plan_code', s.plan_code,
    'plan_name', p.name,
    'billing_cycle', s.billing_cycle,
    'trial_ends_on', s.trial_ends_on,
    'paid_until', s.paid_until,
    'ends_on', v_end,
    'grace_days', s.grace_days,
    'days_left', v_end - p_today,
    'grace_days_left', case when v_state = 'grace' then v_end + v_grace - p_today else null end,
    'courts_used', v_courts,
    'courts_limit', p.max_courts,
    'can_write', v_state <> 'expired'
  );
end;
$$;

revoke execute on function public.club_subscription_info(uuid, date) from public, anon, authenticated;

create function public.club_effective_state(p_club_id uuid)
returns text
language sql stable
security definer
set search_path = public
as $$ select public.club_subscription_info(p_club_id) ->> 'state' $$;

revoke execute on function public.club_effective_state(uuid) from public, anon, authenticated;

-- Para el panel: cualquier miembro la consulta (sin montos).
create function public.club_subscription_status(p_club_id uuid)
returns jsonb
language plpgsql stable
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_club_id) then
    raise exception 'No sos miembro de este club.' using errcode = '42501';
  end if;
  return public.club_subscription_info(p_club_id);
end;
$$;

revoke execute on function public.club_subscription_status(uuid) from public, anon;
grant execute on function public.club_subscription_status(uuid) to authenticated;

-- ¿El club está vencido (solo lectura)? Falso si quien consulta no es miembro.
create function public.club_is_read_only(p_club_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$ select public.is_member(p_club_id) and public.club_effective_state(p_club_id) = 'expired' $$;

revoke execute on function public.club_is_read_only(uuid) from public, anon;
grant execute on function public.club_is_read_only(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Registro de pagos (service role: hoy un script, mañana el webhook de Mercado Pago)
-- ---------------------------------------------------------------------------
-- Idempotente por mp_payment_id: repetido no hace nada; si existía pendiente y llega aprobado, se
-- actualiza y recién ahí extiende. Un pago aprobado activa la suscripción y extiende `paid_until`
-- desde el mayor entre el vencimiento vigente y la fecha de pago, sumando un mes o un año.
create function public.register_subscription_payment(
  p_club_id uuid,
  p_amount numeric,
  p_cycle text,
  p_status text default 'approved',
  p_mp_payment_id text default null,
  p_mp_preapproval_id text default null,
  p_external_reference text default null,
  p_paid_at timestamptz default now(),
  p_raw jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.club_subscriptions%rowtype;
  v_existing public.subscription_payments%rowtype;
  v_paid_on date := (p_paid_at at time zone 'America/Argentina/Buenos_Aires')::date;
  v_base date;
  v_new_until date;
  v_id uuid;
begin
  if p_cycle not in ('monthly', 'yearly') then
    raise exception 'Ciclo no válido: %', p_cycle using errcode = '22023';
  end if;
  if p_status not in ('approved', 'pending', 'rejected', 'refunded') then
    raise exception 'Estado de pago no válido: %', p_status using errcode = '22023';
  end if;

  select * into s from public.club_subscriptions where club_id = p_club_id for update;
  if not found then
    raise exception 'El club no tiene suscripción.' using errcode = '22023';
  end if;

  if p_mp_payment_id is not null then
    select * into v_existing from public.subscription_payments where mp_payment_id = p_mp_payment_id;
    if found then
      -- Mismo pago otra vez: no hace nada, salvo pendiente → aprobado.
      if not (v_existing.status = 'pending' and p_status = 'approved') then
        return jsonb_build_object('payment_id', v_existing.id, 'duplicate', true, 'paid_until', s.paid_until);
      end if;
    end if;
  end if;

  v_base := greatest(coalesce(s.paid_until, s.trial_ends_on), v_paid_on);
  v_new_until := (v_base + case p_cycle when 'monthly' then interval '1 month' else interval '1 year' end)::date;

  if v_existing.id is not null then
    update public.subscription_payments
    set status = p_status, amount = p_amount, billing_cycle = p_cycle, paid_at = p_paid_at,
        period_start = v_base, period_end = v_new_until, plan_code = s.plan_code,
        mp_preapproval_id = coalesce(p_mp_preapproval_id, mp_preapproval_id),
        external_reference = coalesce(p_external_reference, external_reference),
        raw = coalesce(p_raw, raw)
    where id = v_existing.id
    returning id into v_id;
  else
    insert into public.subscription_payments (
      club_id, plan_code, amount, billing_cycle, period_start, period_end, status, paid_at,
      mp_payment_id, mp_preapproval_id, external_reference, raw
    ) values (
      p_club_id, s.plan_code, p_amount, p_cycle, v_base, v_new_until, p_status, p_paid_at,
      p_mp_payment_id, p_mp_preapproval_id, p_external_reference, p_raw
    ) returning id into v_id;
  end if;

  if p_status = 'approved' then
    update public.club_subscriptions
    set status = 'active', billing_cycle = p_cycle, paid_until = v_new_until, updated_at = now()
    where club_id = p_club_id;
    return jsonb_build_object('payment_id', v_id, 'duplicate', false, 'paid_until', v_new_until);
  end if;

  return jsonb_build_object('payment_id', v_id, 'duplicate', false, 'paid_until', s.paid_until);
end;
$$;

revoke execute on function public.register_subscription_payment(uuid, numeric, text, text, text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.register_subscription_payment(uuid, numeric, text, text, text, text, text, timestamptz, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Límite de canchas del plan
-- ---------------------------------------------------------------------------
-- Cuenta las canchas activas del club (de cualquier tipo). Toma `for update` sobre la suscripción para
-- que dos altas simultáneas no pasen el límite. Dar de baja una cancha libera un lugar.
create function public.enforce_court_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans%rowtype;
  v_active int;
begin
  if not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active then
    return new;
  end if;

  select p.* into v_plan
  from public.club_subscriptions s join public.plans p on p.code = s.plan_code
  where s.club_id = new.club_id
  for update of s;

  if not found or v_plan.max_courts is null then
    return new;
  end if;

  select count(*) into v_active from public.courts
  where club_id = new.club_id and active and id is distinct from new.id;

  if v_active >= v_plan.max_courts then
    raise exception 'El plan % incluye hasta % canchas. Pasá a un plan mayor para sumar más.', v_plan.name, v_plan.max_courts
      using errcode = '54000';
  end if;
  return new;
end;
$$;

-- El nombre empieza igual que el de solo lectura y lo sigue: PostgreSQL ejecuta los triggers en orden
-- alfabético, y un club vencido tiene que ver el aviso de solo lectura antes que el del límite.
create trigger courts_subscription_writable_limit
  before insert or update of active on public.courts
  for each row execute function public.enforce_court_limit();

-- ---------------------------------------------------------------------------
-- 6. Solo lectura cuando la suscripción está vencida
-- ---------------------------------------------------------------------------
-- Un trigger genérico en las tablas del club en lugar de reescribir las políticas. Se saltea con el
-- service role (auth.uid() nulo). Quedan afuera `audit_log` (solo registra) y `profiles` (es personal).
create function public.enforce_subscription_writable() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid := case when tg_op = 'DELETE' then old.club_id else new.club_id end;
begin
  if auth.uid() is not null and public.club_effective_state(v_club) = 'expired' then
    raise exception 'La suscripción del club está vencida: solo podés consultar la información hasta regularizar el pago.'
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'courts', 'reservations', 'reservation_participants', 'reservation_series', 'payments',
    'credit_balances', 'settings', 'sport_prices', 'players', 'memberships', 'club_invitations'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.enforce_subscription_writable()',
      t || '_subscription_writable', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Turnos fijos: un club vencido no genera fechas nuevas
-- ---------------------------------------------------------------------------
-- Igual que la versión de 0012, más el corte inicial para clubes en solo lectura.
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

  -- Club vencido (solo lectura): no se generan fechas nuevas, la planilla muestra lo ya cargado.
  if public.club_is_read_only(p_club_id) then
    return;
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


-- ---------------------------------------------------------------------------
-- 8. Alta del club: crea la suscripción en prueba (y después las canchas)
-- ---------------------------------------------------------------------------
-- Igual que la versión de 0008, más la suscripción.
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

  -- Prueba gratis de 30 días con el plan más chico que alcance para las canchas cargadas.
  -- Va antes de las canchas para que el límite del plan no rechace el alta del propio club.
  insert into public.club_subscriptions (club_id, plan_code, status, trial_ends_on)
  values (
    v_club_id,
    case when v_total <= 3 then 'inicial' when v_total <= 6 then 'club' else 'gran_club' end,
    'trial',
    public.today_ar() + 30
  );

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
-- 9. Clubes que ya existen: prueba de 30 días desde hoy, con el plan que corresponde a sus canchas
-- ---------------------------------------------------------------------------
insert into public.club_subscriptions (club_id, plan_code, status, trial_ends_on)
select c.id,
       case when n.courts <= 3 then 'inicial' when n.courts <= 6 then 'club' else 'gran_club' end,
       'trial',
       public.today_ar() + 30
from public.clubs c
cross join lateral (select count(*) as courts from public.courts where club_id = c.id and active) n
on conflict (club_id) do nothing;
