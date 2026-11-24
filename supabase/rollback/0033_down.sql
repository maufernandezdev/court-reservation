-- Vuelta atrás de 0033_special_pricing.sql.
-- Antes de correrlo: los turnos con precio especial pierden su modo y quedan con el precio que
-- tengan; los cobros 'persona' tienen que borrarse o pasarse a 'total' para volver a la restricción vieja.
-- Después, volver a correr ensure_series_until de 0028_approval_rules.sql y la vista de 0026.
drop trigger if exists reservations_enforce_special_pricing on public.reservations;
drop trigger if exists reservation_series_enforce_special_pricing on public.reservation_series;
drop function if exists public.enforce_special_pricing();
drop function if exists public.register_person_payments(uuid, jsonb, boolean, int);
drop function if exists public.reopen_person_reservation(uuid);
drop function if exists public.update_series_pricing(uuid, text, numeric, numeric, int);

drop view if exists public.reservation_board;
create view public.reservation_board as
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
revoke all on public.reservation_board from anon;
grant select on public.reservation_board to authenticated;

alter table public.payments drop column if exists payer_name;
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('seña', 'total', 'saldo'));

alter table public.reservation_series drop constraint if exists reservation_series_pricing_check;
alter table public.reservation_series
  drop column if exists pricing_mode, drop column if exists custom_price,
  drop column if exists unit_price, drop column if exists expected_people;

alter table public.reservations drop constraint if exists reservations_pricing_check;
alter table public.reservations
  drop column if exists pricing_mode, drop column if exists unit_price,
  drop column if exists expected_people, drop column if exists closed_at, drop column if exists closed_by;
-- list_price_for queda: la usa ensure_series_until hasta que se vuelva a correr la de 0028.
