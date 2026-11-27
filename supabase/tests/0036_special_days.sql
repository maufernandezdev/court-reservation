-- Verificación de 0036_special_days (feriados). Corre en una transacción que se revierte: no deja datos.
-- Usa el club de pruebas local ("Club de Pruebas Local", sembrado con court-reservation-localdb/seed-local.mjs).
-- Uso: docker exec -i supabase_db_court-reservation-localdb psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/0036_special_days.sql
-- Cada caso que falla corta con "FALLA: …"; si todo pasa, devuelve "ok".

begin;

create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

do $$
declare
  v_club uuid;
  v_admin uuid;
  v_oper uuid;
  v_court uuid;
  v_day date := public.today_ar() + 3;
  v_res uuid;
begin
  select id into v_club from public.clubs where name = 'Club de Pruebas Local';
  if v_club is null then raise exception 'FALLA: no está el club de pruebas local'; end if;
  select user_id into v_admin from public.memberships where club_id = v_club and role = 'admin' limit 1;
  select user_id into v_oper from public.memberships where club_id = v_club and role = 'operador' limit 1;
  select id into v_court from public.courts where club_id = v_club and name = 'Cancha 4';

  -- La Cancha 4 de ese día queda libre para las pruebas (los datos sembrados la ocupan).
  update public.reservations set status = 'cancelled', cancelled_at = now()
  where court_id = v_court and date = v_day and status in ('active', 'pending_approval');

  -- Un turno suelto con seña y un teléfono, en el día que se va a marcar.
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, price, payment_status)
  values (v_club, v_court, v_day, '10:00', 60, 'Prueba Feriado', '3410000001', 24000, 'senada')
  returning id into v_res;
  insert into public.payments (club_id, reservation_id, kind, amount, method) values (v_club, v_res, 'seña', 7000, 'efectivo');

  insert into _t values ('club', v_club), ('admin', v_admin), ('oper', v_oper), ('court', v_court),
    ('day', v_day), ('res', v_res);
end $$;

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.t(p_k text) returns text language sql as $$ select v from _t where k = p_k $$;

-- 1) El operador no puede marcar feriados.
do $$
begin
  perform pg_temp.act_as(pg_temp.t('oper')::uuid);
  begin
    perform public.apply_special_day(pg_temp.t('club')::uuid, pg_temp.t('day')::date, 'Feriado', true, 30000, 'todos');
    raise exception 'FALLA: el operador marcó un feriado';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 2) El admin marca el día cerrado, con tarifa y cancelando todo.
do $$
declare
  v_out jsonb;
  v_credit numeric;
  v_series_left int;
begin
  perform pg_temp.act_as(pg_temp.t('admin')::uuid);
  v_out := public.apply_special_day(pg_temp.t('club')::uuid, pg_temp.t('day')::date, 'Feriado', true, 30000, 'todos');
  reset role;

  if (v_out ->> 'cancelled')::int < 1 then raise exception 'FALLA: no canceló turnos: %', v_out; end if;
  if exists (select 1 from public.reservations where club_id = pg_temp.t('club')::uuid and date = pg_temp.t('day')::date
             and status in ('active', 'pending_approval')) then
    raise exception 'FALLA: quedaron turnos activos el día del feriado';
  end if;
  if not (select special_day_cancel and not late_cancel from public.reservations where id = pg_temp.t('res')::uuid) then
    raise exception 'FALLA: la cancelación no quedó marcada como de feriado y en término';
  end if;
  if exists (select 1 from public.payments where reservation_id = pg_temp.t('res')::uuid and not released) then
    raise exception 'FALLA: la seña no se liberó';
  end if;
  select amount into v_credit from public.credit_balances where club_id = pg_temp.t('club')::uuid and customer_phone = '3410000001';
  if coalesce(v_credit, 0) <> 7000 then raise exception 'FALLA: saldo a favor esperado 7000, hay %', v_credit; end if;

  -- Los fijos siguen vivos después del feriado.
  select count(*) into v_series_left from public.reservation_series s
  where s.club_id = pg_temp.t('club')::uuid and (s.ends_on is null or s.ends_on > pg_temp.t('day')::date);
  if v_series_left = 0 then raise exception 'FALLA: se terminaron los fijos'; end if;
end $$;

-- 3) Día cerrado: el operador no carga turnos; el admin sí, y toma la tarifa del día.
do $$
declare
  v_price numeric;
begin
  perform pg_temp.act_as(pg_temp.t('oper')::uuid);
  begin
    insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, price)
    values (pg_temp.t('club')::uuid, pg_temp.t('court')::uuid, pg_temp.t('day')::date, '15:00', 60, 'Prueba Op', 24000);
    raise exception 'FALLA: el operador cargó un turno con el club cerrado';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  reset role;

  perform pg_temp.act_as(pg_temp.t('admin')::uuid);
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, price)
  values (pg_temp.t('club')::uuid, pg_temp.t('court')::uuid, pg_temp.t('day')::date, '15:00', 90, 'Prueba Admin', 36000)
  returning price into v_price;
  reset role;
  if v_price <> 45000 then raise exception 'FALLA: precio esperado 45000 (30000/h × 1,5 h), quedó %', v_price; end if;
end $$;

-- 4) Las fechas de fijos que se generan en un día cerrado nacen canceladas.
do $$
declare
  v_far date := public.today_ar() + 30;
  v_bad int;
begin
  perform pg_temp.act_as(pg_temp.t('admin')::uuid);
  perform public.apply_special_day(pg_temp.t('club')::uuid, v_far, 'Feriado lejano', true, null, 'none');
  perform public.ensure_series_until(pg_temp.t('club')::uuid, v_far);
  reset role;
  select count(*) into v_bad from public.reservations
  where club_id = pg_temp.t('club')::uuid and date = v_far and series_id is not null and status = 'active';
  if v_bad > 0 then raise exception 'FALLA: % fechas de fijos activas en el día cerrado', v_bad; end if;
end $$;

-- 5) Quitar el día especial: un turno nuevo vuelve a tomar el precio que manda la app.
do $$
declare
  v_price numeric;
begin
  perform pg_temp.act_as(pg_temp.t('admin')::uuid);
  perform public.remove_special_day(pg_temp.t('club')::uuid, pg_temp.t('day')::date);
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, price)
  values (pg_temp.t('club')::uuid, pg_temp.t('court')::uuid, pg_temp.t('day')::date, '17:00', 60, 'Prueba sin feriado', 24000)
  returning price into v_price;
  reset role;
  if v_price <> 24000 then raise exception 'FALLA: después de quitar el feriado el precio quedó %', v_price; end if;
end $$;

select 'ok' as resultado;
rollback;
