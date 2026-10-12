-- Clubes como entidad propia + invitaciones por link.
-- Antes: el "club" era el id del usuario dueño (`owner_id` / `user_id`).
-- Ahora: tabla `clubs` y columna `club_id` en todas las tablas del club. Los clubes
-- existentes reutilizan el id del dueño como id del club, así ningún dato cambia de valor.
-- `supabase db push` corre cada migración dentro de una transacción.

-- ---------------------------------------------------------------------------
-- 1. Clubes vacíos creados automáticamente al registrarse
-- ---------------------------------------------------------------------------
-- Membresía admin propia sin canchas, reservas, cobros, saldos, políticas,
-- auditoría ni otros miembros: no es un club en uso, se borra.
delete from public.memberships m
where m.owner_id = m.user_id
  and not exists (select 1 from public.courts c where c.user_id = m.owner_id)
  and not exists (select 1 from public.reservations r where r.user_id = m.owner_id)
  and not exists (select 1 from public.payments p where p.owner_id = m.owner_id)
  and not exists (select 1 from public.credit_balances b where b.owner_id = m.owner_id)
  and not exists (select 1 from public.settings s where s.owner_id = m.owner_id)
  and not exists (select 1 from public.audit_log a where a.owner_id = m.owner_id)
  and not exists (
    select 1 from public.memberships o
    where o.owner_id = m.owner_id and o.user_id <> m.user_id
  );

-- ---------------------------------------------------------------------------
-- 2. Tabla clubs (los existentes con id = id del dueño)
-- ---------------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  city text not null default '' check (char_length(city) <= 80),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;

insert into public.clubs (id, name, created_by)
select owner, 'Club Deportivo Central', owner
from (
  select owner_id as owner from public.memberships
  union select user_id from public.courts
  union select user_id from public.reservations
  union select owner_id from public.payments
  union select owner_id from public.credit_balances
  union select owner_id from public.settings
  union select owner_id from public.audit_log
) as existing;

-- ---------------------------------------------------------------------------
-- 3. Se quitan policies, funciones y el alta automática que usan el modelo viejo
-- ---------------------------------------------------------------------------
drop policy if exists "memberships_select" on public.memberships;
drop policy if exists "memberships_admin_insert" on public.memberships;
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

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.find_user_id_by_email(text);
drop function if exists public.adjust_credit_balance(uuid, text, numeric);
drop function if exists public.is_member(uuid);
drop function if exists public.is_admin(uuid);
drop function if exists public.is_staff(uuid);

-- ---------------------------------------------------------------------------
-- 4. owner_id / user_id (dueño) → club_id, con FK a clubs
-- ---------------------------------------------------------------------------
alter table public.memberships rename column owner_id to club_id;
alter table public.courts rename column user_id to club_id;
alter table public.reservations rename column user_id to club_id;
alter table public.payments rename column owner_id to club_id;
alter table public.settings rename column owner_id to club_id;
alter table public.credit_balances rename column owner_id to club_id;
alter table public.audit_log rename column owner_id to club_id;

alter table public.memberships drop constraint memberships_owner_id_fkey;
alter table public.courts drop constraint courts_user_id_fkey;
alter table public.reservations drop constraint reservations_user_id_fkey;
alter table public.payments drop constraint payments_owner_id_fkey;
alter table public.settings drop constraint settings_owner_id_fkey;
alter table public.credit_balances drop constraint credit_balances_owner_id_fkey;
alter table public.audit_log drop constraint audit_log_owner_id_fkey;

alter table public.memberships
  add constraint memberships_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;
alter table public.courts
  add constraint courts_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;
alter table public.reservations
  add constraint reservations_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;
alter table public.payments
  add constraint payments_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;
alter table public.settings
  add constraint settings_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;
alter table public.credit_balances
  add constraint credit_balances_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;
alter table public.audit_log
  add constraint audit_log_club_id_fkey foreign key (club_id) references public.clubs(id) on delete cascade;

alter table public.memberships
  rename constraint memberships_owner_id_user_id_key to memberships_club_id_user_id_key;
alter index public.memberships_owner_id_idx rename to memberships_club_id_idx;
alter index public.courts_user_id_idx rename to courts_club_id_idx;
alter index public.reservations_user_date_idx rename to reservations_club_date_idx;
alter index public.payments_owner_id_idx rename to payments_club_id_idx;
alter index public.audit_log_owner_idx rename to audit_log_club_idx;

-- ---------------------------------------------------------------------------
-- 5. Funciones de pertenencia (SECURITY DEFINER: evitan recursión de RLS)
-- ---------------------------------------------------------------------------
create function public.is_member(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where club_id = p_club_id and user_id = auth.uid()
  );
$$;

create function public.is_admin(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where club_id = p_club_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create function public.is_staff(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where club_id = p_club_id
      and user_id = auth.uid()
      and role in ('admin', 'operador')
  );
$$;

-- Ajuste atómico de saldo a favor (evita lost updates en read-modify-write).
create function public.adjust_credit_balance(
  p_club_id uuid,
  p_phone text,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
begin
  if not public.is_staff(p_club_id) then
    raise exception 'Solo el personal del club puede mover saldos a favor'
      using errcode = '42501';
  end if;

  insert into public.credit_balances (club_id, customer_phone, amount)
  values (p_club_id, p_phone, p_delta)
  on conflict (club_id, customer_phone)
  do update set
    amount = public.credit_balances.amount + p_delta,
    updated_at = now()
  returning amount into v_amount;
  return v_amount;
end;
$$;

revoke execute on function public.adjust_credit_balance(uuid, text, numeric) from public, anon;
grant execute on function public.adjust_credit_balance(uuid, text, numeric) to authenticated;

-- La reserva solo puede apuntar a una cancha del mismo club.
create or replace function public.check_reservation_court_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.courts
    where id = new.court_id and club_id = new.club_id
  ) then
    raise exception 'La cancha no pertenece al club' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_reservation_money()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_hours int;
begin
  if new.payment_status is distinct from old.payment_status
     and not public.is_staff(old.club_id) then
    raise exception 'Solo el personal del club puede cambiar el cobro de una reserva'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and new.status = 'cancelled'
     and not public.is_staff(old.club_id) then
    select cancel_window_hours into v_window_hours
    from public.settings where club_id = old.club_id;
    v_window_hours := coalesce(v_window_hours, 24);

    if old.date + old.time::time < now() + make_interval(hours => v_window_hours) then
      raise exception 'No podés cancelar un turno dentro de la ventana de penalidad. Consultá con un administrador.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS por club
-- ---------------------------------------------------------------------------
-- Clubes: los ven sus miembros; nombre y ciudad los cambia el admin.
-- El alta es solo por create_club (no hay policy de insert ni de delete).
create policy "clubs_select_member" on public.clubs
  for select to authenticated
  using (is_member(id));

create policy "clubs_update_admin" on public.clubs
  for update to authenticated
  using (is_admin(id))
  with check (is_admin(id));

-- Membresías: se ven las de mis clubes; el admin cambia roles y saca miembros.
-- Nadie inserta directo: las membresías nacen de create_club o de aceptar una invitación.
create policy "memberships_select" on public.memberships
  for select to authenticated
  using (is_member(club_id));

create policy "memberships_admin_update" on public.memberships
  for update to authenticated
  using (is_admin(club_id))
  with check (is_admin(club_id));

create policy "memberships_admin_delete" on public.memberships
  for delete to authenticated
  using (is_admin(club_id));

create policy "courts_select_member" on public.courts
  for select to authenticated
  using (is_member(club_id));

create policy "courts_insert_admin" on public.courts
  for insert to authenticated
  with check (is_admin(club_id));

create policy "courts_update_admin" on public.courts
  for update to authenticated
  using (is_admin(club_id))
  with check (is_admin(club_id));

create policy "reservations_select_member" on public.reservations
  for select to authenticated
  using (is_member(club_id));

create policy "reservations_insert_member" on public.reservations
  for insert to authenticated
  with check (is_member(club_id));

create policy "reservations_update_member" on public.reservations
  for update to authenticated
  using (is_member(club_id))
  with check (is_member(club_id));

create policy "reservations_delete_member" on public.reservations
  for delete to authenticated
  using (is_member(club_id));

create policy "payments_select_member" on public.payments
  for select to authenticated
  using (is_member(club_id));

create policy "payments_insert_staff" on public.payments
  for insert to authenticated
  with check (is_staff(club_id));

create policy "payments_update_staff" on public.payments
  for update to authenticated
  using (is_staff(club_id))
  with check (is_staff(club_id));

create policy "settings_select_member" on public.settings
  for select to authenticated
  using (is_member(club_id));

create policy "settings_admin_write" on public.settings
  for insert to authenticated
  with check (is_admin(club_id));

create policy "settings_admin_update" on public.settings
  for update to authenticated
  using (is_admin(club_id))
  with check (is_admin(club_id));

create policy "credit_select_member" on public.credit_balances
  for select to authenticated
  using (is_member(club_id));

create policy "credit_write_staff" on public.credit_balances
  for insert to authenticated
  with check (is_staff(club_id));

create policy "credit_update_staff" on public.credit_balances
  for update to authenticated
  using (is_staff(club_id))
  with check (is_staff(club_id));

create policy "audit_select_member" on public.audit_log
  for select to authenticated
  using (is_member(club_id));

-- El personal registra la operación diaria; el admin además los cambios del club.
create policy "audit_insert_staff" on public.audit_log
  for insert to authenticated
  with check (is_staff(club_id));

-- ---------------------------------------------------------------------------
-- 7. Alta del club (atómica)
-- ---------------------------------------------------------------------------
-- p_courts: {"tenis": 4, "padel": 2, "futbol": 0}. Crea el club, la membresía admin,
-- las políticas por defecto, las canchas numeradas y la auditoría. Devuelve el id.
create function public.create_club(p_name text, p_city text, p_courts jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_city text := trim(coalesce(p_city, ''));
  v_club_id uuid;
  v_email text;
  v_full_name text;
  v_type text;
  v_count int;
  v_total int := 0;
  v_prefix text;
  i int;
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 80 then
    raise exception 'El nombre del club es obligatorio (hasta 80 caracteres).' using errcode = '22023';
  end if;

  if char_length(v_city) > 80 then
    raise exception 'La ciudad puede tener hasta 80 caracteres.' using errcode = '22023';
  end if;

  if p_courts is null or jsonb_typeof(p_courts) <> 'object' then
    raise exception 'Indicá cuántas canchas tenés de cada deporte.' using errcode = '22023';
  end if;

  for v_type in select jsonb_object_keys(p_courts) loop
    if v_type not in ('tenis', 'padel', 'futbol') then
      raise exception 'Deporte no válido: %', v_type using errcode = '22023';
    end if;
    if jsonb_typeof(p_courts -> v_type) <> 'number' then
      raise exception 'La cantidad de canchas tiene que ser un número.' using errcode = '22023';
    end if;
    v_count := (p_courts ->> v_type)::numeric;
    if v_count::numeric <> (p_courts ->> v_type)::numeric or v_count not between 0 and 20 then
      raise exception 'Cada deporte admite entre 0 y 20 canchas.' using errcode = '22023';
    end if;
    v_total := v_total + v_count;
  end loop;

  if v_total < 1 then
    raise exception 'El club necesita al menos una cancha.' using errcode = '22023';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', '')
  into v_email, v_full_name
  from auth.users where id = v_uid;

  insert into public.clubs (name, city, created_by)
  values (v_name, v_city, v_uid)
  returning id into v_club_id;

  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v_club_id, v_uid, 'admin', v_full_name, lower(coalesce(v_email, '')));

  insert into public.settings (club_id) values (v_club_id);

  -- Mismo orden y nombres que la vista previa del alta: tenis, pádel, fútbol.
  foreach v_type in array array['tenis', 'padel', 'futbol'] loop
    v_count := coalesce((p_courts ->> v_type)::int, 0);
    v_prefix := case v_type when 'tenis' then 'Cancha' when 'padel' then 'Pádel' else 'Fútbol' end;
    for i in 1..v_count loop
      insert into public.courts (club_id, name, type)
      values (v_club_id, v_prefix || ' ' || i, v_type);
    end loop;
  end loop;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (
    v_club_id, v_uid, 'club', v_club_id, 'club.created',
    jsonb_build_object('name', v_name, 'city', v_city, 'courts', p_courts)
  );

  return v_club_id;
end;
$$;

revoke execute on function public.create_club(text, text, jsonb) from public, anon;
grant execute on function public.create_club(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Invitaciones
-- ---------------------------------------------------------------------------
-- El token viaja solo en el link; acá se guarda su sha256 (hex).
create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  full_name text not null default '' check (char_length(full_name) <= 120),
  role text not null check (role in ('admin', 'operador', 'profesor')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

alter table public.club_invitations enable row level security;

-- Una sola invitación abierta (ni aceptada ni cancelada) por correo y club.
create unique index club_invitations_open_idx
  on public.club_invitations (club_id, email)
  where accepted_at is null and revoked_at is null;

create policy "invitations_select_admin" on public.club_invitations
  for select to authenticated
  using (is_admin(club_id));

create policy "invitations_insert_admin" on public.club_invitations
  for insert to authenticated
  with check (is_admin(club_id) and invited_by = auth.uid());

create policy "invitations_update_admin" on public.club_invitations
  for update to authenticated
  using (is_admin(club_id))
  with check (is_admin(club_id));

create function public.invitation_token_hash(p_token text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- Lectura pública desde el link. Sin token válido no devuelve datos del club.
create function public.get_invitation(p_token text)
returns table (
  status text,
  club_name text,
  role text,
  email text,
  full_name text,
  expires_at timestamptz,
  has_account boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v public.club_invitations%rowtype;
  v_status text;
begin
  select * into v
  from public.club_invitations
  where token_hash = public.invitation_token_hash(p_token);

  if not found then
    return query select 'invalid'::text, null::text, null::text, null::text, null::text,
      null::timestamptz, null::boolean;
    return;
  end if;

  v_status := case
    when v.revoked_at is not null then 'revoked'
    when v.accepted_at is not null then 'accepted'
    when v.expires_at < now() then 'expired'
    else 'pending'
  end;

  return query
  select
    v_status,
    c.name,
    v.role,
    v.email,
    v.full_name,
    v.expires_at,
    case when v_status = 'pending'
      then exists (select 1 from auth.users u where lower(u.email) = v.email)
      else null
    end
  from public.clubs c
  where c.id = v.club_id;
end;
$$;

revoke execute on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Acepta una invitación para la cuenta autenticada. Uso interno (no expuesta).
create function public.accept_invitation_internal(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.club_invitations%rowtype;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;

  -- for update: el link es de un solo uso aunque se abra dos veces a la vez.
  select * into v from public.club_invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'La invitación no existe.' using errcode = 'P0002';
  end if;
  if v.revoked_at is not null then
    raise exception 'La invitación fue cancelada. Pedile al administrador un link nuevo.' using errcode = 'P0001';
  end if;
  if v.accepted_at is not null then
    raise exception 'La invitación ya se usó.' using errcode = 'P0001';
  end if;
  if v.expires_at < now() then
    raise exception 'La invitación venció. Pedile al administrador un link nuevo.' using errcode = 'P0001';
  end if;
  if v.email <> v_email then
    raise exception 'La invitación es para otro correo.' using errcode = '42501';
  end if;

  -- Si ya era miembro no se duplica ni se cambia el rol.
  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v.club_id, v_uid, v.role, v.full_name, v.email)
  on conflict (club_id, user_id) do nothing;

  update public.club_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v.id;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (
    v.club_id, v_uid, 'member', v_uid, 'invitation.accepted',
    jsonb_build_object('email', v.email, 'role', v.role, 'full_name', v.full_name, 'invitation_id', v.id)
  );

  return v.club_id;
end;
$$;

revoke execute on function public.accept_invitation_internal(uuid) from public, anon, authenticated;

-- Desde el link.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.club_invitations
  where token_hash = public.invitation_token_hash(p_token);

  if v_id is null then
    raise exception 'El link de invitación no es válido.' using errcode = 'P0002';
  end if;

  return public.accept_invitation_internal(v_id);
end;
$$;

revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- Desde la bienvenida ("Me van a invitar"): solo invitaciones para mi correo.
create function public.accept_invitation_by_id(p_invitation_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.accept_invitation_internal(p_invitation_id);
$$;

revoke execute on function public.accept_invitation_by_id(uuid) from public, anon;
grant execute on function public.accept_invitation_by_id(uuid) to authenticated;

create function public.my_pending_invitations()
returns table (id uuid, club_name text, role text, expires_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, c.name, i.role, i.expires_at
  from public.club_invitations i
  join public.clubs c on c.id = i.club_id
  where i.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at >= now()
  order by i.created_at desc;
$$;

revoke execute on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;
