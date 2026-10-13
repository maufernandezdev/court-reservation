-- Vuelta atrás de 0009_profe_color_trigger.sql. Los colores ya asignados quedan.
drop trigger if exists memberships_assign_profe_color on public.memberships;
drop function if exists public.assign_profe_color();
