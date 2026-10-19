-- Invitaciones solo con rol: ya no llevan correo ni nombre. El admin elige el rol (operador o
-- profesor) y comparte un link de un solo uso que vence a los 7 días; quien lo abre carga su nombre,
-- su correo y su contraseña (o entra con su cuenta). Se guarda una nota opcional ("Para quién es")
-- solo para que el admin reconozca cada link pendiente.
-- Se elimina "Me van a invitar" por correo (`my_pending_invitations` y `accept_invitation_by_id`).
-- `supabase db push` corre cada migración dentro de una transacción.

drop function if exists public.my_pending_invitations();
drop function if exists public.accept_invitation_by_id(uuid);
drop function if exists public.get_invitation(text);

drop index if exists public.club_invitations_open_idx;

alter table public.club_invitations
  drop column email,
  drop column full_name,
  add column note text not null default '' check (char_length(note) <= 80);

-- Con un link sin correo, quien lo abre cae como administrador solo si alguien lo pide: no. Un
-- administrador se suma como operador y después se asciende. (not valid: no revisa lo que ya había)
alter table public.club_invitations
  add constraint club_invitations_not_admin_check check (role <> 'admin') not valid;

-- Lectura pública desde el link. Sin token válido no devuelve datos del club.
create function public.get_invitation(p_token text)
returns table (
  status text,
  club_name text,
  role text,
  note text,
  expires_at timestamptz
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
    return query select 'invalid'::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  v_status := case
    when v.revoked_at is not null then 'revoked'
    when v.accepted_at is not null then 'accepted'
    when v.expires_at < now() then 'expired'
    else 'pending'
  end;

  return query
  select v_status, c.name, v.role, v.note, v.expires_at
  from public.clubs c
  where c.id = v.club_id;
end;
$$;

revoke execute on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Acepta una invitación para la cuenta autenticada (cualquier correo). Uso interno.
create or replace function public.accept_invitation_internal(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.club_invitations%rowtype;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text;
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
  if exists (select 1 from public.memberships where club_id = v.club_id and user_id = v_uid) then
    raise exception 'Ya sos parte de este club.' using errcode = 'P0001';
  end if;

  -- El nombre sale del perfil o, si la cuenta es nueva, del que se cargó al crearla desde el link.
  select left(coalesce(
    nullif((select p.full_name from public.profiles p where p.user_id = v_uid), ''),
    nullif((select u.raw_user_meta_data ->> 'full_name' from auth.users u where u.id = v_uid), ''),
    ''
  ), 120) into v_name;

  insert into public.profiles (user_id, full_name)
  values (v_uid, v_name)
  on conflict (user_id) do nothing;

  insert into public.memberships (club_id, user_id, role, full_name, email)
  values (v.club_id, v_uid, v.role, coalesce(v_name, ''), v_email);

  update public.club_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v.id;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (
    v.club_id, v_uid, 'member', v_uid, 'invitation.accepted',
    jsonb_build_object('role', v.role, 'note', v.note, 'full_name', coalesce(v_name, ''), 'email', v_email, 'invitation_id', v.id)
  );

  return v.club_id;
end;
$$;

revoke execute on function public.accept_invitation_internal(uuid) from public, anon, authenticated;
