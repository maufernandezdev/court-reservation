-- Verificación de 0037 (editar un fijo desde una fecha y copias del nombre del jugador).
-- Transacción que se revierte. Club de pruebas local. Uso:
-- docker exec -i supabase_db_court-reservation-localdb psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/0037_series_edit_from.sql

begin;

create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

do $$
declare
  v_club uuid;
  v_series uuid;
  v_first uuid;
begin
  select id into v_club from public.clubs where name = 'Club de Pruebas Local';
  if v_club is null then raise exception 'FALLA: no está el club de pruebas local'; end if;
  -- El fijo de Ana Beltrán (Cancha 1, 20:00, 2 h).
  select id into v_series from public.reservation_series where club_id = v_club and customer_name = 'Ana Beltrán';
  perform set_config('request.jwt.claims', json_build_object('sub',
    (select user_id from public.memberships where club_id = v_club and role = 'admin' limit 1), 'role', 'authenticated')::text, true);
  perform public.ensure_series_until(v_club, public.today_ar() + 21);
  select id into v_first from public.reservations
  where series_id = v_series and date >= public.today_ar() and status = 'active' order by date limit 1;
  insert into _t values ('club', v_club), ('series', v_series), ('first', v_first),
    ('admin', (select user_id from public.memberships where club_id = v_club and role = 'admin' limit 1));
end $$;

create or replace function pg_temp.t(p_k text) returns text language sql as $$ select v from _t where k = p_k $$;
create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- 1) Pasar el fijo de 2 h a 1 h desde la primera fecha futura: cambian el fijo y las fechas siguientes.
do $$
declare
  v_out record;
  v_bad int;
begin
  perform pg_temp.act_as(pg_temp.t('admin')::uuid);
  update public.reservations set duration_minutes = 60 where id = pg_temp.t('first')::uuid;
  select * into v_out from public.update_series_from(pg_temp.t('first')::uuid);
  reset role;
  if v_out.updated_count < 1 then raise exception 'FALLA: no actualizó fechas siguientes: %', v_out; end if;
  if (select duration_minutes from public.reservation_series where id = pg_temp.t('series')::uuid) <> 60 then
    raise exception 'FALLA: el fijo no quedó en 1 h';
  end if;
  select count(*) into v_bad from public.reservations
  where series_id = pg_temp.t('series')::uuid and status = 'active' and date >= public.today_ar() and duration_minutes <> 60;
  if v_bad > 0 then raise exception 'FALLA: % fechas siguen con la duración vieja', v_bad; end if;
end $$;

-- 2) Choque: mover el fijo a una cancha y hora ocupadas en una fecha siguiente no cambia nada.
do $$
declare
  v_next record;
  v_court uuid;
begin
  select id, date, court_id into v_next from public.reservations
  where series_id = pg_temp.t('series')::uuid and status = 'active' and date > (select date from public.reservations where id = pg_temp.t('first')::uuid)
  order by date limit 1;
  select id into v_court from public.courts where club_id = pg_temp.t('club')::uuid and name = 'Cancha 2';
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, price)
  values (pg_temp.t('club')::uuid, v_court, v_next.date, '20:00', 60, 'Prueba choque', 28000);

  perform pg_temp.act_as(pg_temp.t('admin')::uuid);
  update public.reservations set court_id = v_court where id = pg_temp.t('first')::uuid;
  begin
    perform public.update_series_from(pg_temp.t('first')::uuid);
    raise exception 'FALLA: no detectó el choque';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
    if sqlerrm not like '%ocupada%' then raise exception 'FALLA: mensaje inesperado: %', sqlerrm; end if;
  end;
  reset role;
  if (select court_id from public.reservations where id = v_next.id) <> v_next.court_id then
    raise exception 'FALLA: cambió una fecha a pesar del choque';
  end if;
end $$;

select 'ok' as resultado;
rollback;
