-- Vuelta atrás de 0011_profiles.sql. Los nombres ya quedaron copiados en memberships;
-- se pierden las rutas de foto (los archivos siguen en R2 hasta borrarlos a mano).
drop trigger if exists on_auth_user_email_changed on auth.users;
drop function if exists public.sync_membership_email();
drop function if exists public.set_my_profe_color(uuid, text);
drop function if exists public.set_my_avatar(text);
drop function if exists public.update_my_name(text);
drop table if exists public.profiles;
drop function if exists public.shares_club_with(uuid);
