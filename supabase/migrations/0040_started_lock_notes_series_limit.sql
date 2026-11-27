-- Modificaciones (Notion, 27/11): tres cambios sobre los turnos.
-- 1) Turno ya empezado: pasada la hora de inicio, solo el administrador lo cancela o lo borra
--    (`guard_started_reservation`). Las tareas del sistema (sin usuario) no se frenan.
-- 2) Notas del admin en los turnos: `reservation_notes` (una nota por turno, hasta 140 caracteres).
--    La escribe solo el admin (`set_reservation_note`); la ven admin y operador. La planilla la lee
--    de `reservation_board.admin_note`.
-- 3) Fijos con cancelaciones seguidas: `settings.series_cancel_limit` (vacío = no aplica). Cuando una
--    fecha de un fijo se cancela y suma esa cantidad de cancelaciones seguidas, el fijo se da de baja
--    desde la última cancelada: se liberan las fechas siguientes sin cobros y queda
--    `series.auto_ended` en la actividad para avisarle al admin. No cuentan las cancelaciones por
--    día cerrado (`special_day_cancel`) ni las de una baja del fijo.
-- `supabase db push` corre cada migración dentro de una transacción.

-- 1) Turno ya empezado ---------------------------------------------------------------------------
create or replace function public.reservation_started(p_date date, p_time text)
returns boolean
language sql
stable
set search_path = public
as $$
  select (p_date + p_time::time) <= (now() at time zone 'America/Argentina/Buenos_Aires');
$$;

create or replace function public.guard_started_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin usuario (tareas del sistema o service role): no se frena.
  if auth.uid() is null or public.is_admin(old.club_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'cancelled' and public.reservation_started(old.date, old.time) then
      raise exception 'El turno ya empezó: solo el administrador puede borrarlo.' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and public.reservation_started(old.date, old.time) then
    raise exception 'El turno ya empezó: solo el administrador puede cancelarlo.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_guard_started on public.reservations;
create trigger reservations_guard_started
before update of status or delete on public.reservations
for each row execute function public.guard_started_reservation();

-- 2) Notas del admin -----------------------------------------------------------------------------
create table if not exists public.reservation_notes (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 140),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.reservation_notes enable row level security;

drop policy if exists "reservation_notes_select_staff" on public.reservation_notes;
create policy "reservation_notes_select_staff" on public.reservation_notes
  for select to authenticated
  using (public.is_staff(club_id));
-- Sin políticas de escritura: se escribe solo con `set_reservation_note`.

revoke all on public.reservation_notes from anon;
grant select on public.reservation_notes to authenticated;

create or replace function public.set_reservation_note(p_reservation_id uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_body text := nullif(trim(coalesce(p_body, '')), '');
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;
  select club_id into v_club from public.reservations where id = p_reservation_id;
  if v_club is null or not public.is_member(v_club) then
    raise exception 'No se encontró el turno.' using errcode = 'P0002';
  end if;
  if not public.is_admin(v_club) then
    raise exception 'Solo el administrador puede escribir notas en los turnos.' using errcode = '42501';
  end if;
  if public.club_is_read_only(v_club) then
    raise exception 'La suscripción del club está vencida: solo podés consultar la información hasta regularizar el pago.'
      using errcode = '42501';
  end if;
  if v_body is not null and char_length(v_body) > 140 then
    raise exception 'La nota puede tener hasta 140 caracteres.' using errcode = 'P0001';
  end if;

  if v_body is null then
    delete from public.reservation_notes where reservation_id = p_reservation_id;
  else
    insert into public.reservation_notes (reservation_id, club_id, body, updated_by, updated_at)
    values (p_reservation_id, v_club, v_body, auth.uid(), now())
    on conflict (reservation_id)
    do update set body = excluded.body, updated_by = excluded.updated_by, updated_at = now();
  end if;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (v_club, auth.uid(), 'reservation', p_reservation_id,
    case when v_body is null then 'reservation.note_removed' else 'reservation.note_set' end,
    jsonb_strip_nulls(jsonb_build_object('note', v_body)));

  return v_body;
end;
$$;

revoke execute on function public.set_reservation_note(uuid, text) from public, anon;
grant execute on function public.set_reservation_note(uuid, text) to authenticated;

-- La planilla suma la nota (solo para admin y operador; la vista corre con permisos de su dueño).
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
  r.expected_people, r.closed_at, r.closed_by,
  case when public.is_staff(r.club_id)
    then (select n.body from public.reservation_notes n where n.reservation_id = r.id)
  end as admin_note
from public.reservations r
where public.is_member(r.club_id);

-- 3) Baja automática de fijos por cancelaciones seguidas ------------------------------------------
alter table public.settings
  add column if not exists series_cancel_limit integer
  check (series_cancel_limit is null or series_cancel_limit between 2 and 20);

-- ¿La cancelación cuenta como del jugador? (no las de día cerrado ni las de una baja del fijo)
create or replace function public.counts_as_series_cancel(r public.reservations)
returns boolean
language sql
immutable
as $$
  select r.status = 'cancelled'
    and not coalesce(r.special_day_cancel, false)
    and coalesce(r.cancel_reason, '') not in ('Baja de turno fijo', 'Baja automática por cancelaciones');
$$;

create or replace function public.auto_end_series_on_cancels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_run integer := 1;
  v_end date := new.date;
  v_series public.reservation_series%rowtype;
  v_prev_flag text;
  v_cancelled integer := 0;
  v_kept jsonb := '[]'::jsonb;
  o public.reservations%rowtype;
begin
  if new.series_id is null or not public.counts_as_series_cancel(new) then
    return null;
  end if;

  select series_cancel_limit into v_limit from public.settings where club_id = new.club_id;
  if v_limit is null then
    return null;
  end if;

  -- Hacia atrás: cancelaciones seguidas antes de esta fecha (los días cerrados no cortan ni suman).
  for o in
    select * from public.reservations
    where series_id = new.series_id and date < new.date and not coalesce(special_day_cancel, false)
    order by date desc
  loop
    exit when not public.counts_as_series_cancel(o);
    v_run := v_run + 1;
  end loop;

  -- Hacia adelante: cancelaciones ya cargadas después de esta fecha.
  for o in
    select * from public.reservations
    where series_id = new.series_id and date > new.date and not coalesce(special_day_cancel, false)
    order by date
  loop
    exit when not public.counts_as_series_cancel(o);
    v_run := v_run + 1;
    v_end := o.date;
  end loop;

  if v_run < v_limit then
    return null;
  end if;

  select * into v_series from public.reservation_series where id = new.series_id for update;
  if not found or (v_series.ends_on is not null and v_series.ends_on <= v_end) then
    return null;
  end if;

  update public.reservation_series set ends_on = v_end where id = v_series.id;

  -- Las fechas siguientes se liberan en término; las que tienen cobros quedan para gestionarlas a mano.
  -- La marca de `cancel_own_profe_reservation` deja liberar fechas dentro de la ventana de penalidad.
  v_prev_flag := coalesce(current_setting('app.profe_cancel', true), '');
  perform set_config('app.profe_cancel', '1', true);
  for o in
    select * from public.reservations
    where series_id = v_series.id and date > v_end and status in ('active', 'pending_approval')
      and not public.reservation_started(date, time)
    order by date
  loop
    if exists (select 1 from public.payments p where p.reservation_id = o.id and not p.released) then
      v_kept := v_kept || to_jsonb(o.date::text);
    else
      update public.reservations
      set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
          cancel_reason = 'Baja automática por cancelaciones', late_cancel = false,
          updated_by = auth.uid()
      where id = o.id;
      v_cancelled := v_cancelled + 1;
    end if;
  end loop;
  perform set_config('app.profe_cancel', v_prev_flag, true);

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (new.club_id, auth.uid(), 'series', v_series.id, 'series.auto_ended',
    jsonb_build_object(
      'customer_name', v_series.customer_name,
      'cancellations', v_run,
      'limit', v_limit,
      'until', v_end,
      'cancelled', v_cancelled,
      'kept', v_kept
    ));

  return null;
end;
$$;

drop trigger if exists reservations_auto_end_series on public.reservations;
create trigger reservations_auto_end_series
after update of status on public.reservations
for each row
when (new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.series_id is not null)
execute function public.auto_end_series_on_cancels();
