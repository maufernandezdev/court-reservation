-- Seña por audiencia: la seña de `sport_prices` se divide en la del público (turnos estándar y de
-- torneo, apagada: el club inicial no la pide) y la de profes (turnos de profe), que toma la
-- configuración que el club ya tenía. Cada una con interruptor, tipo (fijo o %) y valor.
-- `supabase db push` corre cada migración dentro de una transacción.

alter table public.sport_prices rename column deposit_enabled to profe_deposit_enabled;
alter table public.sport_prices rename column deposit_type to profe_deposit_type;
alter table public.sport_prices rename column deposit_value to profe_deposit_value;

alter table public.sport_prices
  add column public_deposit_enabled boolean not null default false,
  add column public_deposit_type text not null default 'percent'
    check (public_deposit_type in ('fixed', 'percent')),
  add column public_deposit_value numeric(10,2) not null default 0
    check (public_deposit_value >= 0);

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sport_prices'::regclass and conname like 'sport_prices\_deposit\_%'
  loop
    execute format('alter table public.sport_prices rename constraint %I to %I', c.conname,
      replace(c.conname, 'sport_prices_deposit_', 'sport_prices_profe_deposit_'));
  end loop;
end $$;
