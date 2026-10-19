-- Vuelta atrás de 0016_club_hours.sql: cada cancha vuelve a tener el horario del club y turnos de
-- 60 minutos (la duración que tenía cada una se pierde; los turnos ya reservados no cambian).
alter table public.courts
  add column slot_duration int not null default 60,
  add column open_time time not null default '09:00',
  add column close_time time not null default '22:00';

alter table public.courts
  add constraint courts_slot_duration_check check (slot_duration in (30, 60, 90)),
  add constraint courts_time_range_check check (open_time < close_time);

update public.courts c
set open_time = s.open_time, close_time = s.close_time
from public.settings s
where s.club_id = c.club_id;

alter table public.settings
  drop constraint settings_hours_check,
  drop column open_time,
  drop column close_time;
