-- Equipo con o sin acceso a la app.
-- Las personas del equipo que no usan la app (empleados y profes) viven en `cash_payees` (kind empleado/profe):
-- se les puede pagar en Caja sin tener cuenta. "Darle acceso" genera una invitación ligada a esa persona;
-- al aceptarla, la persona queda vinculada a su cuenta (`cash_payees.user_id`) y pasa a verse como miembro.
-- Si después se la quita del club, vuelve a "Sin acceso a la app" (no se pierde para los pagos).
-- Los proveedores (kind proveedor) siguen igual: nunca tienen cuenta.

alter table public.cash_payees
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.cash_payees drop constraint if exists cash_payees_user_staff_check;
alter table public.cash_payees
  add constraint cash_payees_user_staff_check check (user_id is null or kind <> 'proveedor');

create unique index if not exists cash_payees_club_user_idx
  on public.cash_payees (club_id, user_id) where user_id is not null;

alter table public.club_invitations
  add column if not exists payee_id uuid references public.cash_payees(id) on delete set null;

-- Igual que la versión de 0017, más: nombre de la persona del equipo si la cuenta no tiene,
-- y vínculo de esa persona con la cuenta que acepta.
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
  v_payee_name text;
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

  if v.payee_id is not null then
    select p.name into v_payee_name
    from public.cash_payees p
    where p.id = v.payee_id and p.club_id = v.club_id;
  end if;

  -- El nombre sale del perfil, del que se cargó al crear la cuenta desde el link o del equipo.
  select left(coalesce(
    nullif((select p.full_name from public.profiles p where p.user_id = v_uid), ''),
    nullif((select u.raw_user_meta_data ->> 'full_name' from auth.users u where u.id = v_uid), ''),
    nullif(v_payee_name, ''),
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

  if v.payee_id is not null then
    update public.cash_payees
    set user_id = v_uid, active = true, updated_at = now()
    where id = v.payee_id and club_id = v.club_id and kind <> 'proveedor';
  end if;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (
    v.club_id, v_uid, 'member', v_uid, 'invitation.accepted',
    jsonb_build_object('role', v.role, 'note', v.note, 'full_name', coalesce(v_name, ''), 'email', v_email, 'invitation_id', v.id)
  );

  return v.club_id;
end;
$$;

revoke execute on function public.accept_invitation_internal(uuid) from public, anon, authenticated;

-- Al quitar a alguien del club, si estaba en el equipo sin acceso, vuelve a esa lista.
create or replace function public.unlink_payee_on_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cash_payees
  set user_id = null, updated_at = now()
  where club_id = old.club_id and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists memberships_unlink_payee on public.memberships;
create trigger memberships_unlink_payee
after delete on public.memberships
for each row execute function public.unlink_payee_on_member_delete();
