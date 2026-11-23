-- Vuelta atrás de 0030_products_and_payees.sql (se pierden los productos y la lista de a quién se paga;
-- las ventas y salidas ya cargadas no cambian porque guardan nombre y precio).
drop table if exists public.cash_payees;
drop table if exists public.products;
