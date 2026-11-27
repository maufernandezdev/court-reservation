-- Verificación de 0039_profe_account (cuenta del profe: cobro del total u otro monto).
-- Corre todo dentro de una transacción que se revierte: no deja datos.
-- Toma el primer club con admin y crea un profe temporal con tres turnos jugados y uno futuro.
-- Cada caso que falla corta con una excepción "FALLA: …"; si todo pasa, devuelve una fila "ok".

begin;

create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

do $$
declare
  v_club uuid;
  v_admin uuid;
  v_profe uuid := gen_random_uuid();
  v_court uuid;
begin
  select m.club_id, m.user_id into v_club, v_admin
  from public.memberships m join public.courts c on c.club_id = m.club_id
  where m.role = 'admin' and m.user_id is not null
  limit 1;
  if v_club is null then raise exception 'FALLA: no hay un club con admin y canchas'; end if;
  select id into v_court from public.courts where club_id = v_club order by created_at limit 1;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_profe, 'authenticated', 'authenticated',
    'profe-' || v_profe || '@pruebas.invalid', '', now(), '{}', '{}', now(), now());
  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v_club, v_profe, 'profesor', 'Profe de prueba', '');

  insert into public.settings (club_id) values (v_club) on conflict (club_id) do nothing;
  update public.settings set settle_from = public.today_ar() - 20 where club_id = v_club;

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

-- Turnos: A (hace 10 días, $1000), B (hace 5 días, $1000, con seña de $300), C (hace 2 días, $1000), F (futuro).
select pg_temp.act_as((select v::uuid from _t where k = 'admin'));
do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_court uuid := (select v::uuid from _t where k = 'court');
  v_profe uuid := (select v::uuid from _t where k = 'profe');
  v_d date := public.today_ar();
  r uuid;
  kk text;
  d int;
begin
  foreach kk in array array['A', 'B', 'C', 'F'] loop
    d := case kk when 'A' then -10 when 'B' then -5 when 'C' then -2 else 3 end;
    insert into public.reservations (club_id, court_id, date, time, duration_minutes, customer_name, phone, kind,
      profe_user_id, price, created_by, updated_by)
    values (v_club, v_court, v_d + d, '23:00', 60, 'Profe de prueba', '', 'profe', v_profe, 1000, auth.uid(), auth.uid())
    returning id into r;
    insert into _t values (kk, r);
  end loop;
  insert into public.payments (club_id, reservation_id, kind, amount, method, created_by)
  values (v_club, (select v::uuid from _t where k = 'B'), 'seña', 300, 'efectivo', auth.uid());
  update public.reservations set payment_status = 'senada' where id = (select v::uuid from _t where k = 'B');
end $$;

-- 1) Debe 2700 (A 1000 + B 700 + C 1000). Un monto mayor se rechaza.
do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_profe uuid := (select v::uuid from _t where k = 'profe');
begin
  begin
    perform public.settle_profe_amount(v_club, v_profe, 2701, 'efectivo');
    raise exception 'FALLA: aceptó un monto mayor a la deuda';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.settle_profe_amount(v_club, v_profe, 0, 'efectivo');
    raise exception 'FALLA: aceptó monto cero';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- 2) Pago parcial de 1500: A queda pagado, B señado con 500 más (le faltan 200), C sin tocar.
do $$
declare
  v_club uuid := (select v::uuid from _t where k = 'club');
  v_profe uuid := (select v::uuid from _t where k = 'profe');
  res record;
  v_st text;
begin
  select * into res from public.settle_profe_amount(v_club, v_profe, 1500, 'efectivo');
  if res.settled_amount <> 1500 or res.remaining <> 1200 or res.settled_count <> 2 then
    raise exception 'FALLA: parcial devolvió % / % / %', res.settled_amount, res.remaining, res.settled_count;
  end if;
  insert into _t values ('s1', res.settlement_id);
  select payment_status into v_st from public.reservations where id = (select v::uuid from _t where k = 'A');
  if v_st <> 'pagada' then raise exception 'FALLA: A quedó %', v_st; end if;
  select payment_status into v_st from public.reservations where id = (select v::uuid from _t where k = 'B');
  if v_st <> 'senada' then raise exception 'FALLA: B quedó %', v_st; end if;
  if (select sum(amount) from public.payments where reservation_id = (select v::uuid from _t where k = 'B')) <> 800 then
    raise exception 'FALLA: B no tiene 800 cobrados';
  end if;
  select payment_status into v_st from public.reservations where id = (select v::uuid from _t where k = 'C');
  if v_st <> 'pendiente' then raise exception 'FALLA: C quedó %', v_st; end if;
end $$;

-- 3) El profe ve su pago; otro rol no puede cobrar.
select pg_temp.act_as((select v::uuid from _t where k = 'profe'));
do $$
begin
  if (select count(*) from public.profe_settlements where id = (select v::uuid from _t where k = 's1')) <> 1 then
    raise exception 'FALLA: el profe no ve su pago';
  end if;
  begin
    perform public.settle_profe_amount((select v::uuid from _t where k = 'club'), auth.uid(), null, 'efectivo');
    raise exception 'FALLA: el profe pudo cobrarse';
  exception when sqlstate '42501' then null;
  end;
end $$;

-- 4) Total: cobra 1200 (B 200 + C 1000), el futuro no.
select pg_temp.act_as((select v::uuid from _t where k = 'admin'));
do $$
declare
  res record;
begin
  select * into res from public.settle_profe_amount((select v::uuid from _t where k = 'club'), (select v::uuid from _t where k = 'profe'), null, 'mercado_pago');
  if res.settled_amount <> 1200 or res.remaining <> 0 then
    raise exception 'FALLA: total devolvió % / %', res.settled_amount, res.remaining;
  end if;
  if (select payment_status from public.reservations where id = (select v::uuid from _t where k = 'F')) <> 'pendiente' then
    raise exception 'FALLA: se cobró el turno futuro';
  end if;
  if exists (select 1 from public.reservations where id in (select v::uuid from _t where k in ('A','B','C')) and payment_status <> 'pagada') then
    raise exception 'FALLA: quedaron turnos jugados sin pagar';
  end if;
end $$;

-- 5) Deshacer el parcial: A vuelve a pendiente y B a señado con la seña original + el saldo del total.
do $$
declare
  v_st text;
begin
  perform public.void_profe_settlement((select v::uuid from _t where k = 's1'));
  select payment_status into v_st from public.reservations where id = (select v::uuid from _t where k = 'A');
  if v_st <> 'pendiente' then raise exception 'FALLA: A tras deshacer quedó %', v_st; end if;
  select payment_status into v_st from public.reservations where id = (select v::uuid from _t where k = 'B');
  if v_st <> 'senada' then raise exception 'FALLA: B tras deshacer quedó %', v_st; end if;
  if (select sum(amount) from public.payments where reservation_id = (select v::uuid from _t where k = 'B')) <> 500 then
    raise exception 'FALLA: B tras deshacer no tiene 500';
  end if;
end $$;

select pg_temp.reset_role();
select 'ok' as resultado;

rollback;
