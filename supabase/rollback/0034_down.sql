-- Revierte 0034_no_court_overlap.sql
alter table public.reservations drop constraint if exists reservations_no_overlap;
alter table public.reservations drop constraint if exists reservations_time_format_check;
drop function if exists public.hhmm_to_minutes(text);
-- btree_gist queda instalada: otras restricciones podrían usarla.
