-- Horarios que necesitan confirmación del admin.
-- - `approval_rules`: franjas (todas las canchas o una; días de la semana o una fecha puntual).
-- - Un turno que cargan operador, profe u organizador dentro de una franja queda en
--   `pending_approval`: ocupa el lugar hasta que el admin lo confirma (vuelve a `active`)
--   o lo rechaza (`rejected`, libera el lugar). El admin reserva sin confirmación.
-- - Lo aplica un trigger de la base, así no depende de la pantalla.

create table if not exists public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  court_id uuid references public.courts(id) on delete cascade,
  weekdays smallint[],
  on_date date,
  from_time time not null,
  to_time time not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint approval_rules_when_check check ((weekdays is null) <> (on_date is null)),
  constraint approval_rules_weekdays_check check (
    weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
  ),
  constraint approval_rules_times_check check (from_time < to_time)
);

create index if not exists approval_rules_club_idx on public.approval_rules (club_id);

alter table public.approval_rules enable row level security;

-- Todo el equipo las lee (el formulario avisa antes de reservar); solo el admin las cambia.
create policy "approval_rules_select_member" on public.approval_rules
  for select to authenticated using (public.is_member(club_id));
create policy "approval_rules_insert_admin" on public.approval_rules
  for insert to authenticated with check (public.is_admin(club_id));
create policy "approval_rules_delete_admin" on public.approval_rules
  for delete to authenticated using (public.is_admin(club_id));

drop trigger if exists approval_rules_subscription_writable on public.approval_rules;
create trigger approval_rules_subscription_writable
before insert or update or delete on public.approval_rules
for each row execute function public.enforce_subscription_writable();

revoke all on table public.approval_rules from anon;

-- Estados nuevos y quién decidió.
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check
  check (status in ('active', 'cancelled', 'pending_approval', 'rejected'));

alter table public.reservations
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id),
  add column if not exists rejected_at timestamptz;

-- Un turno por confirmar también ocupa el lugar.
drop index if exists public.reservations_active_slot_idx;
create unique index reservations_active_slot_idx
  on public.reservations (court_id, date, time)
  where status in ('active', 'pending_approval');

-- ¿El turno cae en una franja con confirmación?
create or replace function public.requires_approval(
  p_club_id uuid, p_court_id uuid, p_date date, p_time text, p_duration int
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.approval_rules ar
    where ar.club_id = p_club_id
      and (ar.court_id is null or ar.court_id = p_court_id)
      and (ar.on_date = p_date or extract(dow from p_date)::smallint = any(ar.weekdays))
      and p_time::time < ar.to_time
      and (p_time::time + make_interval(mins => p_duration)) > ar.from_time
  );
$$;

grant execute on function public.requires_approval(uuid, uuid, date, text, int) to authenticated;

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
  -- Confirmar o rechazar es del admin.
  if tg_op = 'UPDATE' and old.status = 'pending_approval' and new.status in ('active', 'rejected')
     and not v_is_admin then
    raise exception 'Solo el administrador confirma o rechaza los horarios con confirmación.' using errcode = '42501';
  end if;
  if new.status = 'rejected' and (tg_op = 'INSERT' or old.status is distinct from 'rejected') and not v_is_admin then
    raise exception 'Solo el administrador rechaza turnos.' using errcode = '42501';
  end if;

  -- Las fechas de los turnos fijos se generan solas: la franja se revisa al crear el fijo.
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
    new.status := 'pending_approval';
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_enforce_approval on public.reservations;
create trigger reservations_enforce_approval
before insert or update on public.reservations
for each row execute function public.enforce_reservation_approval();

-- La planilla sin montos suma los datos de la confirmación.
create or replace view public.reservation_board as
select
  r.id, r.club_id, r.court_id, r.date, r.time, r.customer_name, r.phone, r.created_at,
  r.duration_minutes, r.status, r.payment_status, r.cancelled_at, r.cancelled_by,
  r.cancel_reason, r.late_cancel, r.created_by, r.updated_by, r.updated_at, r.kind,
  r.profe_user_id,
  case when public.sees_money(r.club_id) then r.price end as price,
  r.series_id, r.result_winner, r.result_score, r.result_updated_by, r.result_updated_at,
  r.approved_by, r.approved_at, r.rejected_by, r.rejected_at
from public.reservations r
where public.is_member(r.club_id);

-- Los turnos fijos no se generan encima de un turno por confirmar.
CREATE OR REPLACE FUNCTION public.ensure_series_until(p_club_id uuid, p_until date) returns table(series_id uuid, skipped_date date)
    language plpgsql
    set search_path = public
    AS $$
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

  -- El organizador de torneos no ve los turnos con precio: no puede revisar choques, no genera.
  if public.is_organizer(p_club_id) then
    return;
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
        when s.kind = 'profe' and v_is_night then coalesce(nullif(sp.profe_night_price_per_hour, 0), sp.profe_price_per_hour)
        when s.kind = 'profe' then sp.profe_price_per_hour
        when v_is_night then coalesce(nullif(sp.public_night_price_per_hour, 0), sp.public_price_per_hour)
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
