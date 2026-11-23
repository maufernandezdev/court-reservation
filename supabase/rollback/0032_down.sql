-- Vuelta atrás de 0032_blocked_hours_and_profe_settlement.sql.
-- Para volver a "horarios con confirmación", correr de nuevo enforce_reservation_approval de 0028.
drop function if exists public.settle_profe_reservations(uuid, uuid, date, date, text);
