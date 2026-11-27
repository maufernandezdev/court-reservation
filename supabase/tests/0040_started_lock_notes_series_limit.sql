-- Verificación de 0040 (turno empezado solo lo cancela el admin, notas del admin, baja de fijos por
-- cancelaciones seguidas). Corre dentro de una transacción que se revierte: no deja datos.
-- Toma el primer club con admin y canchas, y crea un operador y un profe temporales. Los turnos van
-- a las 06:00, muy lejos de hoy, para no chocar con turnos reales.
-- Cada caso que falla corta con una excepción "FALLA: …"; si todo pasa, devuelve una fila "ok".

begin;

create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

do $$
declare
  v_club uuid;
  v_admin uuid;
  v_oper uuid := gen_random_uuid();
  v_profe uuid := gen_random_uuid();
  v_court uuid;
  u uuid;
begin
  select m.club_id, m.user_id into v_club, v_admin
  from public.memberships m join public.courts c on c.club_id = m.club_id
  where m.role = 'admin' and m.user_id is not null
  limit 1;
  if v_club is null then raise exception 'FALLA: no hay un club con admin y canchas'; end if;
  select id into v_court from public.courts where club_id = v_club order by created_at limit 1;

  foreach u in array array[v_oper, v_profe] loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
      'prueba-' || u || '@pruebas.invalid', '', now(), '{}', '{}', now(), now());
  end loop;
  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v_club, v_oper, 'operador', 'Operador de prueba', ''),
         (v_club, v_profe, 'profesor', 'Profe de prueba', '');

  insert into public.settings (club_id) values (v_club) on conflict (club_id) do nothing;
  update public.settings set series_cancel_limit = 3 where club_id = v_club;

  insert into _t values ('club', v_club), ('admin', v_admin), ('oper', v_oper), ('profe', v_profe), ('court', v_court);
end $$;

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end $$;
create or replace function pg_temp.id(p_k text) returns uuid language sql as $$
  select v::uuid from _t where k = p_k;
$$;

-- Turnos sueltos: P (empezado, hace 400 días), F (futuro, en 400 días), PP (empezado, del profe).
select pg_temp.act_as(pg_temp.id('admin'));
do $$
declare
  r uuid;
begin
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, price, created_by, updated_by)
  values (pg_temp.id('club'), pg_temp.id('court'), public.today_ar() - 400, '06:00', 60, 'Prueba pasada', '', 1000, auth.uid(), auth.uid())
  returning id into r;
  insert into _t values ('P', r);
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, price, created_by, updated_by)
  values (pg_temp.id('club'), pg_temp.id('court'), public.today_ar() + 400, '06:00', 60, 'Prueba futura', '', 1000, auth.uid(), auth.uid())
  returning id into r;
  insert into _t values ('F', r);
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind, profe_user_id, price, created_by, updated_by)
  values (pg_temp.id('club'), pg_temp.id('court'), public.today_ar() - 401, '06:00', 60, 'Profe de prueba', '', 'profe', pg_temp.id('profe'), 1000, auth.uid(), auth.uid())
  returning id into r;
  insert into _t values ('PP', r);
end $$;

-- 1) Turno empezado: el operador no lo cancela ni lo borra; el profe tampoco; el admin sí.
select pg_temp.act_as(pg_temp.id('oper'));
do $$
begin
  begin
    update public.reservations set status = 'cancelled' where id = pg_temp.id('P');
    raise exception 'FALLA: el operador canceló un turno empezado';
  exception when sqlstate '42501' then null;
  end;
  begin
    delete from public.reservations where id = pg_temp.id('P');
    raise exception 'FALLA: el operador borró un turno empezado';
  exception when sqlstate '42501' then null;
  end;
  -- Un turno futuro sí se cancela.
  update public.reservations set status = 'cancelled', cancelled_at = now() where id = pg_temp.id('F');
  if (select status from public.reservations where id = pg_temp.id('F')) <> 'cancelled' then
    raise exception 'FALLA: el operador no pudo cancelar un turno futuro';
  end if;
end $$;

select pg_temp.act_as(pg_temp.id('profe'));
do $$
begin
  begin
    perform public.cancel_own_profe_reservation(pg_temp.id('PP'), '', true);
    raise exception 'FALLA: el profe canceló un turno empezado';
  exception when sqlstate '42501' then null;
  end;
end $$;

select pg_temp.act_as(pg_temp.id('admin'));
do $$
begin
  update public.reservations set status = 'cancelled', cancelled_at = now() where id = pg_temp.id('P');
  if (select status from public.reservations where id = pg_temp.id('P')) <> 'cancelled' then
    raise exception 'FALLA: el admin no pudo cancelar un turno empezado';
  end if;
end $$;

-- 2) Notas: el admin escribe; el operador la ve y no la escribe; el profe no la ve.
do $$
begin
  perform public.set_reservation_note(pg_temp.id('F'), '  Debe la clase del martes  ');
  if (select admin_note from public.reservation_board where id = pg_temp.id('F')) <> 'Debe la clase del martes' then
    raise exception 'FALLA: la nota no quedó en la planilla';
  end if;
  begin
    perform public.set_reservation_note(pg_temp.id('F'), repeat('x', 141));
    raise exception 'FALLA: aceptó una nota de 141 caracteres';
  exception when sqlstate 'P0001' then null;
  end;
end $$;

select pg_temp.act_as(pg_temp.id('oper'));
do $$
begin
  if (select admin_note from public.reservation_board where id = pg_temp.id('F')) is distinct from 'Debe la clase del martes' then
    raise exception 'FALLA: el operador no ve la nota';
  end if;
  begin
    perform public.set_reservation_note(pg_temp.id('F'), 'hola');
    raise exception 'FALLA: el operador escribió una nota';
  exception when sqlstate '42501' then null;
  end;
end $$;

select pg_temp.act_as(pg_temp.id('profe'));
do $$
begin
  if (select admin_note from public.reservation_board where id = pg_temp.id('F')) is not null then
    raise exception 'FALLA: el profe ve la nota';
  end if;
  if (select count(*) from public.reservation_notes) <> 0 then
    raise exception 'FALLA: el profe lee la tabla de notas';
  end if;
end $$;

select pg_temp.act_as(pg_temp.id('admin'));
do $$
begin
  perform public.set_reservation_note(pg_temp.id('F'), '   ');
  if exists (select 1 from public.reservation_notes where reservation_id = pg_temp.id('F')) then
    raise exception 'FALLA: una nota vacía no la borró';
  end if;
end $$;

-- 3) Fijo con 6 fechas (S1…S6, semanales desde dentro de 500 días) y S6 con un cobro.
--    Límite 3: cancelar S1 y S2 no da de baja; cancelar S3 da de baja desde S3 (S4 y S5 se liberan,
--    S6 queda por el cobro).
do $$
declare
  v_series uuid;
  r uuid;
  i int;
  v_start date := public.today_ar() + 500;
begin
  insert into public.reservation_series (club_id, court_id, weekday, start_time, duration_minutes, kind,
    customer_name, phone, starts_on, generated_until, created_by)
  values (pg_temp.id('club'), pg_temp.id('court'), extract(dow from v_start)::int, '06:00', 60, 'standard',
    'Fijo de prueba', '', v_start, v_start + 35, auth.uid())
  returning id into v_series;
  insert into _t values ('series', v_series);
  for i in 1..6 loop
    insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone,
      price, series_id, created_by, updated_by)
    values (pg_temp.id('club'), pg_temp.id('court'), v_start + (i - 1) * 7, '06:00', 60, 'Fijo de prueba', '',
      1000, v_series, auth.uid(), auth.uid())
    returning id into r;
    insert into _t values ('S' || i, r);
  end loop;
  insert into public.payments (club_id, reservation_id, kind, amount, method, created_by)
  values (pg_temp.id('club'), pg_temp.id('S6'), 'seña', 300, 'efectivo', auth.uid());
end $$;

select pg_temp.act_as(pg_temp.id('oper'));
do $$
declare
  v_ends date;
begin
  update public.reservations set status = 'cancelled', cancelled_at = now() where id = pg_temp.id('S1');
  update public.reservations set status = 'cancelled', cancelled_at = now() where id = pg_temp.id('S2');
  select ends_on into v_ends from public.reservation_series where id = pg_temp.id('series');
  if v_ends is not null then raise exception 'FALLA: dio de baja con 2 cancelaciones'; end if;

  update public.reservations set status = 'cancelled', cancelled_at = now() where id = pg_temp.id('S3');
  select ends_on into v_ends from public.reservation_series where id = pg_temp.id('series');
  if v_ends is distinct from (select date from public.reservations where id = pg_temp.id('S3')) then
    raise exception 'FALLA: el fijo no terminó en S3 (ends_on = %)', v_ends;
  end if;
  if (select count(*) from public.reservations
      where id in (pg_temp.id('S4'), pg_temp.id('S5')) and status = 'cancelled'
        and cancel_reason = 'Baja automática por cancelaciones') <> 2 then
    raise exception 'FALLA: S4 y S5 no se liberaron';
  end if;
  if (select status from public.reservations where id = pg_temp.id('S6')) <> 'active' then
    raise exception 'FALLA: S6 (con cobro) no quedó activa';
  end if;
end $$;

select pg_temp.reset_role();
do $$
begin
  if not exists (select 1 from public.audit_log where entity_id = pg_temp.id('series') and action = 'series.auto_ended'
                 and (payload->>'cancellations')::int = 3 and (payload->>'cancelled')::int = 2
                 and jsonb_array_length(payload->'kept') = 1) then
    raise exception 'FALLA: falta el aviso series.auto_ended';
  end if;
end $$;

select 'ok' as resultado;

rollback;
