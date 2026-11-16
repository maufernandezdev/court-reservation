-- Torneos: rol "organizador", resultado de los partidos y precio de torneo.
--
-- El organizador de torneos ve toda la planilla pero ningún monto. Postgres no puede ocultar
-- una columna por usuario con RLS, así que:
-- - Las tablas con plata (reservations, payments, sport_prices, credit_balances, audit_log)
--   dejan de ser legibles para el organizador.
-- - La app lee los turnos de la vista `reservation_board`, que muestra todas las columnas de
--   `reservations` con `price` en null para quien no puede ver plata.
-- - Lo que el organizador escribe pasa por las Server Actions, que validan rol y reglas.

-- 1) Rol nuevo -----------------------------------------------------------------------------
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('admin', 'operador', 'profesor', 'organizador'));

alter table public.club_invitations drop constraint if exists club_invitations_role_check;
alter table public.club_invitations
  add constraint club_invitations_role_check check (role in ('admin', 'operador', 'profesor', 'organizador'));

create or replace function public.is_organizer(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where club_id = p_club_id and user_id = auth.uid() and role = 'organizador'
  );
$$;

-- Miembro del club que puede ver montos (todos menos el organizador de torneos).
create or replace function public.sees_money(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where club_id = p_club_id and user_id = auth.uid() and role <> 'organizador'
  );
$$;

grant execute on function public.is_organizer(uuid) to authenticated;
grant execute on function public.sees_money(uuid) to authenticated;

-- 2) Plata fuera del alcance del organizador ---------------------------------------------
drop policy if exists "reservations_select_member" on public.reservations;
create policy "reservations_select_member" on public.reservations
  for select to authenticated using (public.sees_money(club_id));

drop policy if exists "payments_select_member" on public.payments;
create policy "payments_select_member" on public.payments
  for select to authenticated using (public.sees_money(club_id));

drop policy if exists "sport_prices_select_member" on public.sport_prices;
create policy "sport_prices_select_member" on public.sport_prices
  for select to authenticated using (public.sees_money(club_id));

drop policy if exists "credit_select_member" on public.credit_balances;
create policy "credit_select_member" on public.credit_balances
  for select to authenticated using (public.sees_money(club_id));

drop policy if exists "audit_select_member" on public.audit_log;
create policy "audit_select_member" on public.audit_log
  for select to authenticated using (public.sees_money(club_id));

-- 3) Resultado de los partidos de torneo --------------------------------------------------
alter table public.reservations
  add column if not exists result_winner smallint check (result_winner in (1, 2)),
  add column if not exists result_score text check (char_length(result_score) <= 60),
  add column if not exists result_updated_by uuid references auth.users(id),
  add column if not exists result_updated_at timestamptz;

alter table public.reservations drop constraint if exists reservations_result_torneo_check;
alter table public.reservations
  add constraint reservations_result_torneo_check
  check (kind = 'torneo' or (result_winner is null and result_score is null));

-- 4) Planilla sin montos: la vista que lee la app -----------------------------------------
-- Corre con los permisos de su dueño (no del que consulta) y filtra por club del usuario.
create or replace view public.reservation_board as
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

-- 5) Precio de torneo por tipo de cancha (arranca igual al del público) --------------------
alter table public.sport_prices
  add column if not exists torneo_price_per_hour numeric(10,2) not null default 0 check (torneo_price_per_hour >= 0),
  add column if not exists torneo_night_price_per_hour numeric(10,2) not null default 0 check (torneo_night_price_per_hour >= 0);

update public.sport_prices
set torneo_price_per_hour = public_price_per_hour,
    torneo_night_price_per_hour = public_night_price_per_hour;
