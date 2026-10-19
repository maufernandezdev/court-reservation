-- Vuelta atrás de 0017_invitations_by_role.sql: las invitaciones vuelven a llevar correo y nombre
-- (las que quedaron abiertas reciben un correo de relleno y hay que volver a generarlas) y vuelve
-- "Me van a invitar".
drop function if exists public.get_invitation(text);
drop function if exists public.accept_invitation_internal(uuid);
drop function if exists public.accept_invitation(text);

alter table public.club_invitations
  drop constraint club_invitations_not_admin_check,
  drop column note,
  add column email text not null default 'pendiente@invalido.local'
    check (email = lower(trim(email)) and position('@' in email) > 1),
  add column full_name text not null default '' check (char_length(full_name) <= 120);

alter table public.club_invitations alter column email drop default;

create unique index club_invitations_open_idx
  on public.club_invitations (club_id, email)
  where accepted_at is null and revoked_at is null;

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
