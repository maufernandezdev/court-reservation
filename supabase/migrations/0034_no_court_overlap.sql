-- Una cancha no puede tener dos turnos que se pisen el mismo día, sea cual sea el tipo
-- (estándar, profe, torneo) o el precio (de lista, sin cargo/cortesía, por persona, monto fijo).
-- Hasta ahora solo lo validaba la app: un insert o update directo (por ejemplo con el cliente de
-- Supabase del navegador) o dos altas simultáneas podían superponer turnos. La base lo garantiza.
-- Ocupan la cancha los turnos activos y los que esperan aprobación (igual que en la app).

create extension if not exists btree_gist with schema extensions;

-- La hora se guarda como texto 'HH:MM': se fija el formato para poder calcular los minutos.
alter table public.reservations
  add constraint reservations_time_format_check
    check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Minutos desde la medianoche de una hora 'HH:MM' (inmutable, usable en índices).
create or replace function public.hhmm_to_minutes(p_time text)
returns int
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int;
$$;

alter table public.reservations
  add constraint reservations_no_overlap
    exclude using gist (
      court_id with =,
      date with =,
      int4range(
        public.hhmm_to_minutes(time),
        public.hhmm_to_minutes(time) + duration_minutes
      ) with &&
    )
    where (status in ('active', 'pending_approval'));
