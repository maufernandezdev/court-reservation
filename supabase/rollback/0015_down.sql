-- Vuelta atrás de 0015_deposit_by_audience.sql: queda una sola seña (la de profes, que era la
-- configuración original); se pierde la del público.
alter table public.sport_prices
  drop column public_deposit_enabled,
  drop column public_deposit_type,
  drop column public_deposit_value;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sport_prices'::regclass and conname like 'sport_prices\_profe\_deposit\_%'
  loop
    execute format('alter table public.sport_prices rename constraint %I to %I', c.conname,
      replace(c.conname, 'sport_prices_profe_deposit_', 'sport_prices_deposit_'));
  end loop;
end $$;

alter table public.sport_prices rename column profe_deposit_enabled to deposit_enabled;
alter table public.sport_prices rename column profe_deposit_type to deposit_type;
alter table public.sport_prices rename column profe_deposit_value to deposit_value;
