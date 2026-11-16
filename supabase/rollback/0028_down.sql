-- Vuelta atrás de 0028_approval_rules.sql.
-- Ojo: los turnos por confirmar pasan a activos y los rechazados a cancelados; se pierden las franjas.
drop trigger if exists reservations_enforce_approval on public.reservations;
drop function if exists public.enforce_reservation_approval();
drop function if exists public.requires_approval(uuid, uuid, date, text, int);
drop table if exists public.approval_rules;

update public.reservations set status = 'active' where status = 'pending_approval';
update public.reservations set status = 'cancelled', cancelled_at = coalesce(cancelled_at, rejected_at), cancelled_by = coalesce(cancelled_by, rejected_by)
  where status = 'rejected';

drop view if exists public.reservation_board;
create view public.reservation_board as
select
  r.id, r.club_id, r.court_id, r.date, r.time, r.customer_name, r.phone, r.created_at,
  r.duration_minutes, r.status, r.payment_status, r.cancelled_at, r.cancelled_by,
  r.cancel_reason, r.late_cancel, r.created_by, r.updated_by, r.updated_at, r.kind,
  r.profe_user_id,
  case when public.sees_money(r.club_id) then r.price end as price,
  r.series_id, r.result_winner, r.result_score, r.result_updated_by, r.result_updated_at
from public.reservations r
where public.is_member(r.club_id);
revoke all on public.reservation_board from anon;
grant select on public.reservation_board to authenticated;

alter table public.reservations
  drop column if exists approved_by,
  drop column if exists approved_at,
  drop column if exists rejected_by,
  drop column if exists rejected_at;

drop index if exists public.reservations_active_slot_idx;
create unique index reservations_active_slot_idx
  on public.reservations (court_id, date, time) where status = 'active';

alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check check (status in ('active', 'cancelled'));

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
