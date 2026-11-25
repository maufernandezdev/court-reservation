-- Verificación de 0035_profe_settlement_periods (liquidación de profes por período).
-- Corre todo dentro de una transacción que se revierte: no deja datos.
-- Usa el club de pruebas (ver .claude/test-club.md) y crea un profe temporal.
-- Uso: supabase db query --linked -f supabase/tests/0035_profe_settlement_periods.sql
-- Cada caso que falla corta con una excepción "FALLA: …"; si todo pasa, devuelve una fila "ok".

begin;

create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

do $$
declare
  v_club uuid := '24037bab-a6c5-4fff-a8a8-c7cd1fd1a99e';
  v_admin uuid := 'e2069660-6424-4eda-8cb9-6398dfb591bd';
  v_profe uuid := gen_random_uuid();
  v_court uuid;
begin
  select id into v_court from public.courts where club_id = v_club order by created_at limit 1;
  if v_court is null then raise exception 'FALLA: el club de pruebas no tiene canchas'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_profe, 'authenticated', 'authenticated',
    'profe-' || v_profe || '@pruebas.invalid', '', now(), '{}', '{}', now(), now());
  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v_club, v_profe, 'profesor', 'Profe de prueba', '');

  insert into public.settings (club_id) values (v_club) on conflict (club_id) do nothing;
  update public.settings set settle_from = public.today_ar() - 35 where club_id = v_club;

  insert into _t values ('club', v_club), ('admin', v_admin), ('profe', v_profe), ('court', v_court);
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

-- Turnos del profe: dos ya jugados en el período (uno con seña), uno antes de "Liquidar desde",
-- uno de hoy que todavía no terminó y uno futuro.
select pg_temp.act_as((select v::uuid from _t where k = 'admin'));
do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_court uuid := (select v::uuid from _t where k = 'court');
  v_profe uuid := (select v::uuid from _t where k = 'profe');
  v_d date := public.today_ar();
  r_a uuid; r_b uuid; r_old uuid; r_today uuid; r_future uuid;
begin
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind,
    profe_user_id, price, created_by, updated_by)
  values (v_club, v_court, v_d - 30, '08:00', 60, 'Profe de prueba', '', 'profe', v_profe, 1000, auth.uid(), auth.uid())
  returning id into r_a;
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind,
    profe_user_id, price, created_by, updated_by)
  values (v_club, v_court, v_d - 30, '09:00', 60, 'Profe de prueba', '', 'profe', v_profe, 1000, auth.uid(), auth.uid())
  returning id into r_b;
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind,
    profe_user_id, price, created_by, updated_by)
  values (v_club, v_court, v_d - 40, '08:00', 60, 'Profe de prueba', '', 'profe', v_profe, 1000, auth.uid(), auth.uid())
  returning id into r_old;
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind,
    profe_user_id, price, created_by, updated_by)
  values (v_club, v_court, v_d, '23:00', 60, 'Profe de prueba', '', 'profe', v_profe, 1000, auth.uid(), auth.uid())
  returning id into r_today;
  insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind,
    profe_user_id, price, created_by, updated_by)
  values (v_club, v_court, v_d + 30, '08:00', 60, 'Profe de prueba', '', 'profe', v_profe, 1000, auth.uid(), auth.uid())
  returning id into r_future;

  -- Seña en r_b.
  insert into public.payments (club_id, reservation_id, kind, amount, method, created_by)
  values (v_club, r_b, 'seña', 300, 'efectivo', auth.uid());
  update public.reservations set payment_status = 'senada' where id = r_b;

  insert into _t values ('r_a', r_a), ('r_b', r_b), ('r_old', r_old), ('r_today', r_today), ('r_future', r_future);
end $$;

-- 1) El profe no puede liquidarse a sí mismo.
select pg_temp.act_as((select v::uuid from _t where k = 'profe'));
do $$
declare v_failed boolean := false;
begin
  begin
    perform public.settle_profe_pending((select v::uuid from _t where k = 'club'), (select v::uuid from _t where k = 'profe'),
      public.today_ar(), 'efectivo');
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: un profe registró una liquidación'; end if;
end $$;

-- 2) Admin: no se liquida el futuro; sí todo lo pendiente ya jugado desde "Liquidar desde".
select pg_temp.act_as((select v::uuid from _t where k = 'admin'));
do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_profe uuid := (select v::uuid from _t where k = 'profe');
  v_failed boolean := false;
  r record;
  v_price_a numeric;
  v_price_b numeric;
  v_status text;
begin
  begin
    perform public.settle_profe_pending(v_club, v_profe, public.today_ar() + 1, 'efectivo');
  exception when sqlstate '22023' then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se liquidó una fecha futura'; end if;

  select price into v_price_a from public.reservations where id = (select v::uuid from _t where k = 'r_a');
  select price into v_price_b from public.reservations where id = (select v::uuid from _t where k = 'r_b');

  select * into r from public.settle_profe_pending(v_club, v_profe, public.today_ar(), 'mercado_pago');
  if r.settled_count <> 2 then raise exception 'FALLA: se liquidaron % turnos (esperaba 2)', r.settled_count; end if;
  if r.settled_amount <> v_price_a + greatest(0, v_price_b - 300) then
    raise exception 'FALLA: monto % (esperaba %)', r.settled_amount, v_price_a + greatest(0, v_price_b - 300);
  end if;
  insert into _t values ('settlement', r.settlement_id);

  for v_status in
    select payment_status from public.reservations
    where id in ((select v::uuid from _t where k = 'r_old'), (select v::uuid from _t where k = 'r_today'),
                 (select v::uuid from _t where k = 'r_future'))
  loop
    if v_status = 'pagada' then raise exception 'FALLA: se pagó un turno fuera del período o no jugado'; end if;
  end loop;

  if (select count(*) from public.payments where settlement_id = r.settlement_id) <> 2 then
    raise exception 'FALLA: los cobros no quedaron ligados a la liquidación';
  end if;
  if not exists (select 1 from public.profe_settlements s where s.id = r.settlement_id and s.turns_count = 2
                 and s.amount = r.settled_amount and s.period_from = public.today_ar() - 35) then
    raise exception 'FALLA: el historial no guardó la liquidación';
  end if;

  -- Sin pendientes: no se crea una liquidación vacía.
  v_failed := false;
  begin
    perform public.settle_profe_pending(v_club, v_profe, public.today_ar(), 'efectivo');
  exception when sqlstate '22023' then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se registró una liquidación sin turnos'; end if;
end $$;

-- 3) Deshacer: el profe no puede; el admin sí, una sola vez.
select pg_temp.act_as((select v::uuid from _t where k = 'profe'));
do $$
declare v_failed boolean := false;
begin
  begin
    perform public.void_profe_settlement((select v::uuid from _t where k = 'settlement'));
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: un profe deshizo una liquidación'; end if;
end $$;

select pg_temp.act_as((select v::uuid from _t where k = 'admin'));
do $$
declare
  v_settlement uuid := (select v::uuid from _t where k = 'settlement');
  r record;
  v_failed boolean := false;
begin
  select * into r from public.void_profe_settlement(v_settlement);
  if r.reverted_count <> 2 then raise exception 'FALLA: se revirtieron % turnos (esperaba 2)', r.reverted_count; end if;
  if exists (select 1 from public.payments where settlement_id = v_settlement) then
    raise exception 'FALLA: quedaron cobros de la liquidación deshecha';
  end if;
  if (select payment_status from public.reservations where id = (select v::uuid from _t where k = 'r_a')) <> 'pendiente' then
    raise exception 'FALLA: el turno sin seña no volvió a pendiente';
  end if;
  if (select payment_status from public.reservations where id = (select v::uuid from _t where k = 'r_b')) <> 'senada' then
    raise exception 'FALLA: el turno con seña no volvió a señado';
  end if;
  if not exists (select 1 from public.profe_settlements where id = v_settlement and voided_at is not null) then
    raise exception 'FALLA: la liquidación no quedó marcada como deshecha';
  end if;

  begin
    perform public.void_profe_settlement(v_settlement);
  exception when sqlstate '22023' then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLA: se deshizo dos veces la misma liquidación'; end if;
end $$;

select pg_temp.reset_role();
select 'ok' as resultado;

rollback;
