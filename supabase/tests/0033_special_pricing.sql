-- Verificación de 0033_special_pricing (precio especial en turnos y fijos).
-- Corre todo dentro de una transacción que se revierte: no deja datos.
-- Usa el club de pruebas (ver .claude/test-club.md) y crea un operador temporal.
-- Uso: supabase db query --linked -f supabase/tests/0033_special_pricing.sql
-- Cada caso que falla corta con una excepción "FALLA: …"; si todo pasa, devuelve una fila "ok".

begin;

create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

do $$
declare
  v_club uuid := '24037bab-a6c5-4fff-a8a8-c7cd1fd1a99e';
  v_admin uuid := 'e2069660-6424-4eda-8cb9-6398dfb591bd';
  v_oper uuid := gen_random_uuid();
  v_court uuid;
begin
  select id into v_court from public.courts where club_id = v_club order by created_at limit 1;
  if v_court is null then raise exception 'FALLA: el club de pruebas no tiene canchas'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_oper, 'authenticated', 'authenticated',
    'operador-' || v_oper || '@pruebas.invalid', '', now(), '{}', '{}', now(), now());
  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v_club, v_oper, 'operador', 'Operador de prueba', '');

  insert into _t values ('club', v_club), ('admin', v_admin), ('oper', v_oper), ('court', v_court);
end $$;

-- Helper: actuar como un usuario.
create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 1) Fijos especiales: el admin los crea y la generación hereda el modo.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as((select v::uuid from _t where k = 'admin'));

do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_court uuid := (select v::uuid from _t where k = 'court');
  v_start date := public.today_ar() + 1;
  s_sin uuid; s_pp uuid; s_fijo uuid;
  r record;
begin
  insert into public.reservation_series (club_id, court_id, weekday, start_time, duration_minutes, kind,
    customer_name, phone, participants, starts_on, generated_until, created_by, pricing_mode)
  values (v_club, v_court, extract(dow from v_start)::int, '08:00', 60, 'standard', 'Clase Diego', '', '[]',
    v_start, v_start - 1, auth.uid(), 'sin_cargo')
  returning id into s_sin;

  insert into public.reservation_series (club_id, court_id, weekday, start_time, duration_minutes, kind,
    customer_name, phone, participants, starts_on, generated_until, created_by, pricing_mode, unit_price, expected_people)
  values (v_club, v_court, extract(dow from v_start)::int, '10:00', 120, 'standard', 'Dobles jubilados', '', '[]',
    v_start, v_start - 1, auth.uid(), 'por_persona', 10000, 4)
  returning id into s_pp;

  insert into public.reservation_series (club_id, court_id, weekday, start_time, duration_minutes, kind,
    customer_name, phone, participants, starts_on, generated_until, created_by, pricing_mode, custom_price)
  values (v_club, v_court, extract(dow from v_start)::int, '14:00', 60, 'standard', 'Monto fijo', '', '[]',
    v_start, v_start - 1, auth.uid(), 'monto_fijo', 15000)
  returning id into s_fijo;

  perform * from public.ensure_series_until(v_club, v_start + 14);

  -- 3 semanas × 3 fijos
  if (select count(*) from public.reservations where series_id in (s_sin, s_pp, s_fijo)) <> 9 then
    raise exception 'FALLA: se esperaban 9 turnos generados';
  end if;
  for r in select * from public.reservations where series_id = s_sin loop
    if r.pricing_mode <> 'sin_cargo' or r.price <> 0 or r.payment_status <> 'pagada' then
      raise exception 'FALLA: turno sin cargo mal generado (%, %, %)', r.pricing_mode, r.price, r.payment_status;
    end if;
  end loop;
  for r in select * from public.reservations where series_id = s_pp loop
    if r.pricing_mode <> 'por_persona' or r.unit_price <> 10000 or r.expected_people <> 4 or r.price <> 0
       or r.payment_status <> 'pendiente' or r.closed_at is not null then
      raise exception 'FALLA: turno por persona mal generado';
    end if;
  end loop;
  for r in select * from public.reservations where series_id = s_fijo loop
    if r.pricing_mode <> 'monto_fijo' or r.price <> 15000 then
      raise exception 'FALLA: turno de monto fijo mal generado (%)', r.price;
    end if;
  end loop;

  insert into _t values ('s_sin', s_sin), ('s_pp', s_pp), ('s_fijo', s_fijo);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2) Solo el admin: el operador no puede poner precio especial, pero sí generar fijos especiales.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as((select v::uuid from _t where k = 'oper'));

do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_court uuid := (select v::uuid from _t where k = 'court');
  v_res uuid;
  v_failed boolean;
begin
  -- Alta de un turno especial: rechazada.
  v_failed := false;
  begin
    insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone,
      kind, price, pricing_mode, payment_status, created_by, updated_by)
    values (v_club, v_court, public.today_ar() + 40, '20:00', 60, 'Cortesía', '', 'standard', 0, 'sin_cargo',
      'pagada', auth.uid(), auth.uid());
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: el operador cargó un turno sin cargo'; end if;

  -- Alta de un fijo especial: rechazada.
  v_failed := false;
  begin
    insert into public.reservation_series (club_id, court_id, weekday, start_time, duration_minutes, kind,
      customer_name, phone, participants, starts_on, generated_until, created_by, pricing_mode, custom_price)
    values (v_club, v_court, 1, '21:00', 60, 'standard', 'X', '', '[]', public.today_ar() + 40,
      public.today_ar() + 39, auth.uid(), 'monto_fijo', 1);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: el operador creó un fijo con monto fijo'; end if;

  -- Cambiar el modo de un turno existente: rechazado.
  select id into v_res from public.reservations
  where series_id = (select v::uuid from _t where k = 's_fijo') order by date limit 1;
  v_failed := false;
  begin
    update public.reservations set pricing_mode = 'sin_cargo', price = 0 where id = v_res;
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: el operador cambió el modo de precio'; end if;

  -- Cobrar por persona: rechazado.
  select id into v_res from public.reservations
  where series_id = (select v::uuid from _t where k = 's_pp') order by date limit 1;
  v_failed := false;
  begin
    perform public.register_person_payments(v_res,
      '[{"amount": 10000, "method": "efectivo"}]'::jsonb, false, null);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: el operador cobró por persona'; end if;

  -- Generar fechas de un fijo especial: permitido (la planilla la abre cualquiera).
  perform * from public.ensure_series_until(v_club, public.today_ar() + 22);
  if (select count(*) from public.reservations
      where series_id = (select v::uuid from _t where k = 's_pp')) <> 4 then
    raise exception 'FALLA: el operador no pudo generar la fecha del fijo por persona';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3) Cuenta por persona: cobros, cobro único en varios medios, cerrar y reabrir.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as((select v::uuid from _t where k = 'admin'));

do $$
declare
  v_res uuid;
  v_other uuid;
  r record;
  v_failed boolean;
begin
  select id into v_res from public.reservations
  where series_id = (select v::uuid from _t where k = 's_pp') order by date limit 1;

  -- Dos cobros individuales.
  perform public.register_person_payments(v_res,
    '[{"amount": 10000, "method": "mercado_pago", "payer_name": "Ana"}]'::jsonb, false, null);
  perform public.register_person_payments(v_res,
    '[{"amount": 10000, "method": "efectivo"}]'::jsonb, false, null);
  select * into r from public.reservations where id = v_res;
  if r.price <> 20000 or r.closed_at is not null or r.payment_status <> 'pendiente' then
    raise exception 'FALLA: tras dos cobros (precio %, estado %)', r.price, r.payment_status;
  end if;
  if (select count(*) from public.payments where reservation_id = v_res and kind = 'persona') <> 2
     or not exists (select 1 from public.payments where reservation_id = v_res and payer_name = 'Ana') then
    raise exception 'FALLA: los cobros por persona no quedaron registrados';
  end if;

  -- Cobro único repartido en dos medios y cierre.
  perform public.register_person_payments(v_res,
    '[{"amount": 100000, "method": "mercado_pago"}, {"amount": 25000, "method": "efectivo"}]'::jsonb, true, 14);
  select * into r from public.reservations where id = v_res;
  if r.price <> 145000 or r.closed_at is null or r.payment_status <> 'pagada' or r.expected_people <> 14 then
    raise exception 'FALLA: cobro único y cierre (precio %, cerrado %, personas %)', r.price, r.closed_at, r.expected_people;
  end if;

  -- Cerrado: no acepta más cobros.
  v_failed := false;
  begin
    perform public.register_person_payments(v_res, '[{"amount": 1, "method": "efectivo"}]'::jsonb, false, null);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se cobró sobre una cuenta cerrada'; end if;

  -- Línea en $0: rechazada.
  select id into v_other from public.reservations
  where series_id = (select v::uuid from _t where k = 's_pp') and id <> v_res order by date limit 1;
  v_failed := false;
  begin
    perform public.register_person_payments(v_other, '[{"amount": 0, "method": "efectivo"}]'::jsonb, false, null);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se aceptó un cobro de $0'; end if;

  -- Turno que no es por persona: rechazado.
  v_failed := false;
  begin
    perform public.register_person_payments(
      (select id from public.reservations where series_id = (select v::uuid from _t where k = 's_fijo') limit 1),
      '[{"amount": 1000, "method": "efectivo"}]'::jsonb, false, null);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se cobró por persona un turno de monto fijo'; end if;

  -- Reabrir: vuelve a aceptar cobros sin duplicar los anteriores.
  perform public.reopen_person_reservation(v_res);
  select * into r from public.reservations where id = v_res;
  if r.closed_at is not null or r.payment_status <> 'pendiente' or r.price <> 145000 then
    raise exception 'FALLA: reabrir';
  end if;
  perform public.register_person_payments(v_res, '[{"amount": 5000, "method": "efectivo"}]'::jsonb, true, null);
  select * into r from public.reservations where id = v_res;
  if r.price <> 150000 or (select count(*) from public.payments where reservation_id = v_res) <> 5 then
    raise exception 'FALLA: cobro después de reabrir (precio %)', r.price;
  end if;

  insert into _t values ('res_cobrado', v_res);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4) Cambiar el precio del fijo: solo turnos futuros sin cobros.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  v_series uuid := (select v::uuid from _t where k = 's_pp');
  v_cobrado uuid := (select v::uuid from _t where k = 'res_cobrado');
  v_n int;
  v_failed boolean;
begin
  v_n := public.update_series_pricing(v_series, 'por_persona', null, 12000, 4);
  if v_n <> 3 then raise exception 'FALLA: se esperaban 3 turnos actualizados, fueron %', v_n; end if;
  if (select unit_price from public.reservations where id = v_cobrado) <> 10000 then
    raise exception 'FALLA: se cambió el precio de un turno con cobros';
  end if;
  if exists (select 1 from public.reservations where series_id = v_series and id <> v_cobrado and unit_price <> 12000) then
    raise exception 'FALLA: quedaron turnos futuros sin el precio nuevo';
  end if;
  if (select unit_price from public.reservation_series where id = v_series) <> 12000 then
    raise exception 'FALLA: el fijo no guardó el precio nuevo';
  end if;

  -- A sin cargo: los futuros quedan en $0 y pagados.
  perform public.update_series_pricing(v_series, 'sin_cargo', null, null, null);
  if exists (select 1 from public.reservations where series_id = v_series and id <> v_cobrado
             and (price <> 0 or payment_status <> 'pagada')) then
    raise exception 'FALLA: el paso a sin cargo no dejó los turnos en $0 y pagados';
  end if;

  -- Validación: por persona sin precio.
  v_failed := false;
  begin
    perform public.update_series_pricing(v_series, 'por_persona', null, null, null);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se aceptó por persona sin precio'; end if;
end $$;

select pg_temp.act_as((select v::uuid from _t where k = 'oper'));
do $$
declare v_failed boolean := false;
begin
  begin
    perform public.update_series_pricing((select v::uuid from _t where k = 's_fijo'), 'sin_cargo', null, null, null);
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: el operador cambió el precio de un fijo'; end if;
end $$;

select pg_temp.reset_role();
select 'ok' as resultado;

rollback;
