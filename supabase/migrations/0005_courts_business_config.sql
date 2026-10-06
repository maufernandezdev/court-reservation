-- Configuracion de negocio por cancha: precio, duracion de turno, horarios y sena.
-- Defaults no destructivos: las canchas existentes quedan con precio 0, turnos de 60
-- minutos, 09:00-22:00 y sena deshabilitada (hay que configurarlas para cobrar).

alter table public.courts
  add column price_per_hour numeric(10,2) not null default 0,
  add column slot_duration int not null default 60,
  add column open_time time not null default '09:00',
  add column close_time time not null default '22:00',
  add column deposit_enabled boolean not null default false,
  add column deposit_type text not null default 'percent',
  add column deposit_value numeric(10,2) not null default 0;

alter table public.courts
  add constraint courts_slot_duration_check check (slot_duration in (30, 60, 90));

alter table public.courts
  add constraint courts_deposit_type_check check (deposit_type in ('fixed', 'percent'));

alter table public.courts
  add constraint courts_time_range_check check (open_time < close_time);

alter table public.courts
  add constraint courts_deposit_value_check check (deposit_value >= 0);
