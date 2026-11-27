-- Revierte 0039_profe_account: quita el cobro por monto y la lectura propia del profe.
-- `void_profe_settlement` queda con la versión nueva (compatible con las liquidaciones de 0035).
drop policy if exists "profe_settlements_select_own" on public.profe_settlements;
drop function if exists public.settle_profe_amount(uuid, uuid, numeric, text);
