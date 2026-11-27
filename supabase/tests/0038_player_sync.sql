-- Verificación de 0038_player_sync. Corre en una transacción que se revierte: no deja datos.
-- Toma cualquier jugador que tenga turnos vinculados (sirve con los datos de prod copiados en local).
-- Uso: docker exec -i supabase_db_court-reservation-localdb psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/0038_player_sync.sql
-- Cada caso que falla corta con "FALLA: …"; si todo pasa, devuelve "ok".

begin;

do $$
declare
  v_player uuid;
  v_old_phone text;
begin
  select p.player_id into v_player
  from public.reservation_participants p
  join public.reservations r on r.id = p.reservation_id
  where p.player_id is not null and p.position = 1 and r.kind <> 'profe'
  group by p.player_id order by count(*) desc limit 1;
  if v_player is null then raise exception 'FALLA: no hay jugadores con turnos vinculados'; end if;

  -- 1) Cambio de nombre y teléfono: pasa a sus personas, a los turnos que reservó y a sus fijos.
  update public.players set full_name = 'Prueba Sync Nombre', phone = '3419999999' where id = v_player;

  if exists (select 1 from public.reservation_participants where player_id = v_player and name <> 'Prueba Sync Nombre') then
    raise exception 'FALLA: quedaron personas con el nombre viejo';
  end if;
  if exists (select 1 from public.reservations r join public.reservation_participants p on p.reservation_id = r.id and p.position = 1
             where p.player_id = v_player and r.kind <> 'profe'
               and (r.customer_name <> 'Prueba Sync Nombre' or r.phone <> '3419999999')) then
    raise exception 'FALLA: quedaron turnos con el nombre o teléfono viejo';
  end if;
  if exists (select 1 from public.reservation_series s, jsonb_array_elements(s.participants) e
             where e ->> 'player_id' = v_player::text and e ->> 'name' <> 'Prueba Sync Nombre') then
    raise exception 'FALLA: quedaron fijos con el nombre viejo';
  end if;

  -- 2) Borrar el teléfono del jugador no borra el de sus turnos.
  update public.players set phone = '' where id = v_player;
  if exists (select 1 from public.reservations r join public.reservation_participants p on p.reservation_id = r.id and p.position = 1
             where p.player_id = v_player and r.kind <> 'profe' and r.phone <> '3419999999') then
    raise exception 'FALLA: un teléfono vacío pisó el de los turnos';
  end if;
end $$;

select 'ok' as resultado;
rollback;
