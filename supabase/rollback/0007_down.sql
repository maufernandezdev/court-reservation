-- Vuelta atrás de 0007_clubs_and_invitations.sql (solo emergencia, a mano en el SQL Editor
-- o con `psql -1 -f`). No está en `migrations/` para que `supabase db push` no lo aplique.
-- Después de correrlo: `supabase migration repair --status reverted 0007` y volver a
-- desplegar el código anterior.
--
-- Limitaciones:
-- - Aborta si existe algún club creado después de 0007 (su id no es el de un usuario,
--   y el modelo viejo identifica el club por el id del dueño).
-- - Las invitaciones se pierden.
-- - Los clubes vacíos borrados por 0007 no vuelven tal cual: cada usuario sin membresía
--   vuelve a quedar como admin de su propio club (mismo backfill que 0004).

do $$
begin
  if exists (
    select 1 from public.clubs c
    where not exists (select 1 from auth.users u where u.id = c.id)
  ) then
    raise exception 'Hay clubes creados después de 0007: no se pueden pasar al modelo anterior.';
  end if;
end;
$$;

-- Invitaciones y alta del club
drop function if exists public.my_pending_invitations();
drop function if exists public.accept_invitation_by_id(uuid);
drop function if exists public.accept_invitation(text);
drop function if exists public.accept_invitation_internal(uuid);
drop function if exists public.get_invitation(text);
drop function if exists public.invitation_token_hash(text);
drop table if exists public.club_invitations;
drop function if exists public.create_club(text, text, jsonb);

-- Policies por club
drop policy if exists "clubs_select_member" on public.clubs;
drop policy if exists "clubs_update_admin" on public.clubs;
drop policy if exists "memberships_select" on public.memberships;
drop policy if exists "memberships_admin_update" on public.memberships;
drop policy if exists "memberships_admin_delete" on public.memberships;
drop policy if exists "courts_select_member" on public.courts;
drop policy if exists "courts_insert_admin" on public.courts;
drop policy if exists "courts_update_admin" on public.courts;
drop policy if exists "reservations_select_member" on public.reservations;
drop policy if exists "reservations_insert_member" on public.reservations;
drop policy if exists "reservations_update_member" on public.reservations;
drop policy if exists "reservations_delete_member" on public.reservations;
drop policy if exists "payments_select_member" on public.payments;
drop policy if exists "payments_insert_staff" on public.payments;
drop policy if exists "payments_update_staff" on public.payments;
drop policy if exists "settings_select_member" on public.settings;
drop policy if exists "settings_admin_write" on public.settings;
drop policy if exists "settings_admin_update" on public.settings;
drop policy if exists "credit_select_member" on public.credit_balances;
drop policy if exists "credit_write_staff" on public.credit_balances;
drop policy if exists "credit_update_staff" on public.credit_balances;
drop policy if exists "audit_select_member" on public.audit_log;
drop policy if exists "audit_insert_staff" on public.audit_log;

drop function if exists public.adjust_credit_balance(uuid, text, numeric);
drop function if exists public.is_member(uuid);
drop function if exists public.is_admin(uuid);
drop function if exists public.is_staff(uuid);

-- club_id → owner_id / user_id, FK de vuelta a auth.users
alter table public.memberships drop constraint memberships_club_id_fkey;
alter table public.courts drop constraint courts_club_id_fkey;
alter table public.reservations drop constraint reservations_club_id_fkey;
alter table public.payments drop constraint payments_club_id_fkey;
alter table public.settings drop constraint settings_club_id_fkey;
alter table public.credit_balances drop constraint credit_balances_club_id_fkey;
alter table public.audit_log drop constraint audit_log_club_id_fkey;

alter table public.memberships rename column club_id to owner_id;
alter table public.courts rename column club_id to user_id;
alter table public.reservations rename column club_id to user_id;
alter table public.payments rename column club_id to owner_id;
alter table public.settings rename column club_id to owner_id;
alter table public.credit_balances rename column club_id to owner_id;
alter table public.audit_log rename column club_id to owner_id;

alter table public.memberships
  add constraint memberships_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.courts
  add constraint courts_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.reservations
  add constraint reservations_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.payments
  add constraint payments_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.settings
  add constraint settings_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.credit_balances
  add constraint credit_balances_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.audit_log
  add constraint audit_log_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade;

alter table public.memberships
  rename constraint memberships_club_id_user_id_key to memberships_owner_id_user_id_key;
alter index public.memberships_club_id_idx rename to memberships_owner_id_idx;
alter index public.courts_club_id_idx rename to courts_user_id_idx;
alter index public.reservations_club_date_idx rename to reservations_user_date_idx;
alter index public.payments_club_id_idx rename to payments_owner_id_idx;
alter index public.audit_log_club_idx rename to audit_log_owner_idx;

drop table public.clubs;

-- Funciones y trigger del modelo anterior (copiadas de 0002, 0004 y 0006)
create function public.is_member(p_owner_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where owner_id = p_owner_id and user_id = auth.uid()
  );
$$;

create function public.is_admin(p_owner_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where owner_id = p_owner_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create function public.is_staff(p_owner_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where owner_id = p_owner_id and user_id = auth.uid() and role in ('admin', 'operador')
  );
$$;

create function public.find_user_id_by_email(p_email text)
returns uuid language sql security definer stable set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function public.find_user_id_by_email(text) from public, anon;
grant execute on function public.find_user_id_by_email(text) to authenticated;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.memberships (owner_id, user_id, role, email)
  values (new.id, new.id, 'admin', coalesce(new.email, ''))
  on conflict (owner_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.adjust_credit_balance(p_owner_id uuid, p_phone text, p_delta numeric)
returns numeric language plpgsql security definer set search_path = public
as $$
declare
  v_amount numeric;
begin
  if not public.is_staff(p_owner_id) then
    raise exception 'Solo el personal del club puede mover saldos a favor'
      using errcode = '42501';
  end if;

  insert into public.credit_balances (owner_id, customer_phone, amount)
  values (p_owner_id, p_phone, p_delta)
  on conflict (owner_id, customer_phone)
  do update set
    amount = public.credit_balances.amount + p_delta,
    updated_at = now()
  returning amount into v_amount;
  return v_amount;
end;
$$;

revoke execute on function public.adjust_credit_balance(uuid, text, numeric) from public, anon;
grant execute on function public.adjust_credit_balance(uuid, text, numeric) to authenticated;

create or replace function public.check_reservation_court_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.courts
    where id = new.court_id and user_id = new.user_id
  ) then
    raise exception 'La cancha no pertenece al usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_reservation_money()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_window_hours int;
begin
  if new.payment_status is distinct from old.payment_status
     and not public.is_staff(old.user_id) then
    raise exception 'Solo el personal del club puede cambiar el cobro de una reserva'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and new.status = 'cancelled'
     and not public.is_staff(old.user_id) then
    select cancel_window_hours into v_window_hours
    from public.settings where owner_id = old.user_id;
    v_window_hours := coalesce(v_window_hours, 24);

    if old.date + old.time::time < now() + make_interval(hours => v_window_hours) then
      raise exception 'No podés cancelar un turno dentro de la ventana de penalidad. Consultá con un administrador.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

insert into public.memberships (owner_id, user_id, role, email)
select id, id, 'admin', coalesce(email, '') from auth.users
where not exists (select 1 from public.memberships m where m.user_id = auth.users.id)
on conflict (owner_id, user_id) do nothing;

-- Policies del modelo anterior (0004 y 0006)
create policy "memberships_select" on public.memberships
  for select to authenticated using (is_member(owner_id));
create policy "memberships_admin_insert" on public.memberships
  for insert to authenticated with check (is_admin(owner_id));
create policy "memberships_admin_update" on public.memberships
  for update to authenticated using (is_admin(owner_id)) with check (is_admin(owner_id));
create policy "memberships_admin_delete" on public.memberships
  for delete to authenticated using (is_admin(owner_id));

create policy "courts_select_member" on public.courts
  for select to authenticated using (is_member(user_id));
create policy "courts_insert_admin" on public.courts
  for insert to authenticated with check (is_admin(user_id));
create policy "courts_update_admin" on public.courts
  for update to authenticated using (is_admin(user_id)) with check (is_admin(user_id));

create policy "reservations_select_member" on public.reservations
  for select to authenticated using (is_member(user_id));
create policy "reservations_insert_member" on public.reservations
  for insert to authenticated with check (is_member(user_id));
create policy "reservations_update_member" on public.reservations
  for update to authenticated using (is_member(user_id)) with check (is_member(user_id));
create policy "reservations_delete_member" on public.reservations
  for delete to authenticated using (is_member(user_id));

create policy "payments_select_member" on public.payments
  for select to authenticated using (is_member(owner_id));
create policy "payments_insert_staff" on public.payments
  for insert to authenticated with check (is_staff(owner_id));
create policy "payments_update_staff" on public.payments
  for update to authenticated using (is_staff(owner_id)) with check (is_staff(owner_id));

create policy "settings_select_member" on public.settings
  for select to authenticated using (is_member(owner_id));
create policy "settings_admin_write" on public.settings
  for insert to authenticated with check (is_admin(owner_id));
create policy "settings_admin_update" on public.settings
  for update to authenticated using (is_admin(owner_id)) with check (is_admin(owner_id));

create policy "credit_select_member" on public.credit_balances
  for select to authenticated using (is_member(owner_id));
create policy "credit_write_staff" on public.credit_balances
  for insert to authenticated with check (is_staff(owner_id));
create policy "credit_update_staff" on public.credit_balances
  for update to authenticated using (is_staff(owner_id)) with check (is_staff(owner_id));

create policy "audit_select_member" on public.audit_log
  for select to authenticated using (is_member(owner_id));
create policy "audit_insert_staff" on public.audit_log
  for insert to authenticated with check (is_staff(owner_id));
