-- Nuevos precios de los planes (definidos el 2026-11-09).
-- Anual = 12 meses con 10 % de descuento (equivalente mensual: 18.000 / 31.500 / 45.000).
-- Los pagos ya registrados conservan su monto: solo cambia el precio de lista.
update public.plans set monthly_price = 20000, yearly_price = 216000 where code = 'inicial';
update public.plans set monthly_price = 35000, yearly_price = 378000 where code = 'club';
update public.plans set monthly_price = 50000, yearly_price = 540000 where code = 'gran_club';
