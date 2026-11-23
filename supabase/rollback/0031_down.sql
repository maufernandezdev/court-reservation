-- Vuelta atrás de 0031_team_without_app_access.sql.
-- Restaura accept_invitation_internal de 0017 (correr ese bloque de 0017 después de esto).
drop trigger if exists memberships_unlink_payee on public.memberships;
drop function if exists public.unlink_payee_on_member_delete();
alter table public.club_invitations drop column if exists payee_id;
drop index if exists public.cash_payees_club_user_idx;
alter table public.cash_payees drop constraint if exists cash_payees_user_staff_check;
alter table public.cash_payees drop column if exists user_id;
