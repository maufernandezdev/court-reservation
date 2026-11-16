-- Vuelta atrás de 0025_cash_register.sql.
-- Ojo: borra los movimientos de caja y los cambios iniciales cargados. Los cobros con
-- Mercado Pago pasan a "otro" para que vuelva a valer el check anterior.
drop table if exists public.cash_movements;
drop table if exists public.cash_openings;
drop function if exists public.protect_cash_movement();

update public.payments set method = 'otro' where method = 'mercado_pago';
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('efectivo', 'transferencia', 'otro'));
