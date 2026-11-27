-- Rollback de 0040_started_lock_notes_series_limit.sql
drop trigger if exists reservations_auto_end_series on public.reservations;
drop function if exists public.auto_end_series_on_cancels();
drop function if exists public.counts_as_series_cancel(public.reservations);
alter table public.settings drop column if exists series_cancel_limit;

-- La vista vuelve a la de 0033 (sin la nota).
drop view if exists public.reservation_board;
create view public.reservation_board as
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
  r.expected_people, r.closed_at, r.closed_by
from public.reservations r
where public.is_member(r.club_id);
revoke all on public.reservation_board from anon;
grant select on public.reservation_board to authenticated;

drop function if exists public.set_reservation_note(uuid, text);
drop table if exists public.reservation_notes;

drop trigger if exists reservations_guard_started on public.reservations;
drop function if exists public.guard_started_reservation();
drop function if exists public.reservation_started(date, text);
