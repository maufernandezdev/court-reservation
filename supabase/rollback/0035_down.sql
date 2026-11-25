-- Revierte 0035_profe_settlement_periods.sql.
-- Los cobros hechos por liquidaciones quedan como cobros sueltos (se pierde el vínculo y el historial).
drop function if exists public.void_profe_settlement(uuid);
drop function if exists public.settle_profe_pending(uuid, uuid, date, text);
drop function if exists public.now_minutes_ar();
drop index if exists public.payments_settlement_id_idx;
alter table public.payments drop column if exists settlement_id;
drop table if exists public.profe_settlements;
alter table public.settings drop column if exists settle_from;
