-- Deshace 0036_special_days. Las cancelaciones hechas por feriado quedan canceladas.
drop function if exists public.remove_special_day(uuid, date);
drop function if exists public.apply_special_day(uuid, date, text, boolean, numeric, text);
drop trigger if exists reservations_special_day on public.reservations;
drop function if exists public.apply_special_day_to_reservation();
alter table public.reservations drop column if exists special_day_cancel;
drop table if exists public.club_special_days;
