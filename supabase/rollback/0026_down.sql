-- Vuelta atrás de 0026_tournament_organizer.sql.
-- Ojo: los organizadores pasan a profesor y se pierden los resultados y el precio de torneo.
drop view if exists public.reservation_board;

alter table public.sport_prices
  drop column if exists torneo_price_per_hour,
  drop column if exists torneo_night_price_per_hour;

alter table public.reservations drop constraint if exists reservations_result_torneo_check;
alter table public.reservations
  drop column if exists result_winner,
  drop column if exists result_score,
  drop column if exists result_updated_by,
  drop column if exists result_updated_at;

drop policy if exists "reservations_select_member" on public.reservations;
create policy "reservations_select_member" on public.reservations
  for select to authenticated using (public.is_member(club_id));
drop policy if exists "payments_select_member" on public.payments;
create policy "payments_select_member" on public.payments
  for select to authenticated using (public.is_member(club_id));
drop policy if exists "sport_prices_select_member" on public.sport_prices;
create policy "sport_prices_select_member" on public.sport_prices
  for select to authenticated using (public.is_member(club_id));
drop policy if exists "credit_select_member" on public.credit_balances;
create policy "credit_select_member" on public.credit_balances
  for select to authenticated using (public.is_member(club_id));
drop policy if exists "audit_select_member" on public.audit_log;
create policy "audit_select_member" on public.audit_log
  for select to authenticated using (public.is_member(club_id));

drop function if exists public.sees_money(uuid);
drop function if exists public.is_organizer(uuid);

update public.memberships set role = 'profesor' where role = 'organizador';
update public.club_invitations set role = 'profesor' where role = 'organizador';
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('admin', 'operador', 'profesor'));
alter table public.club_invitations drop constraint if exists club_invitations_role_check;
alter table public.club_invitations
  add constraint club_invitations_role_check check (role in ('admin', 'operador', 'profesor'));
