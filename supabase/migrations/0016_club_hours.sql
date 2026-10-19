-- Horario del club: la apertura y el cierre pasan de cada cancha a `settings` (uno por club) y se
-- eliminan de `courts` la duración del turno y el horario: la duración se elige en cada turno
-- (`reservations.duration_minutes`, de 30 a 360 min) y el horario es el del club.
-- El horario de cada club arranca con la apertura más temprana y el cierre más tardío de sus canchas
-- activas, así ningún turno posible deja de serlo.
-- `supabase db push` corre cada migración dentro de una transacción.

alter table public.settings
  add column open_time time not null default '09:00',
  add column close_time time not null default '22:00',
  add constraint settings_hours_check check (open_time < close_time);

update public.settings s
set open_time = c.opens, close_time = c.closes
from (
  select club_id, min(open_time) as opens, max(close_time) as closes
  from public.courts
  where active
  group by club_id
) c
where c.club_id = s.club_id and c.opens < c.closes;

alter table public.courts
  drop column slot_duration,
  drop column open_time,
  drop column close_time;
