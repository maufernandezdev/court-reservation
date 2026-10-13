-- Perfil de cada persona: nombre único (sincronizado con sus membresías), foto
-- (guardada en Cloudflare R2; acá solo la ruta) y color del profe elegido por él.
-- Migración aditiva. Todas las escrituras pasan por funciones: así el nombre se
-- mantiene igual en `profiles` y en todas las `memberships` de la persona.

-- ---------------------------------------------------------------------------
-- 1. Tabla profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_path text,
  avatar_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ¿La persona de la sesión comparte algún club con p_user_id (o es ella misma)?
create function public.shares_club_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_user_id = auth.uid()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.club_id = mine.club_id
      where mine.user_id = auth.uid() and theirs.user_id = p_user_id
    );
$$;

revoke execute on function public.shares_club_with(uuid) from public, anon;
grant execute on function public.shares_club_with(uuid) to authenticated;

-- Se lee el propio perfil y el de quienes comparten club. No hay escritura directa.
create policy "profiles_select_shared_club" on public.profiles
  for select to authenticated
  using (shares_club_with(user_id));

-- Backfill: un perfil por usuario con el nombre más reciente no vacío de sus membresías
-- (o el de los metadatos de la cuenta).
insert into public.profiles (user_id, full_name)
select
  u.id,
  left(coalesce(
    (
      select m.full_name from public.memberships m
      where m.user_id = u.id and m.full_name <> ''
      order by m.created_at desc
      limit 1
    ),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    ''
  ), 120)
from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Nombre propio (perfil + todas las membresías)
-- ---------------------------------------------------------------------------
create function public.update_my_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_full_name, ''));
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'El nombre es obligatorio (hasta 120 caracteres).' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, full_name, updated_at)
  values (v_uid, v_name, now())
  on conflict (user_id) do update set full_name = excluded.full_name, updated_at = now();

  update public.memberships set full_name = v_name where user_id = v_uid;
end;
$$;

revoke execute on function public.update_my_name(text) from public, anon;
grant execute on function public.update_my_name(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Foto propia (la app sube el archivo a R2; acá se guarda la ruta)
-- ---------------------------------------------------------------------------
create function public.set_my_avatar(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;
  -- Solo la ruta propia (o null para quitarla).
  if p_path is not null and p_path <> 'avatars/' || v_uid::text || '.webp' then
    raise exception 'Ruta de foto inválida.' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, avatar_path, avatar_updated_at, updated_at)
  values (v_uid, p_path, case when p_path is null then null else now() end, now())
  on conflict (user_id) do update set
    avatar_path = excluded.avatar_path,
    avatar_updated_at = excluded.avatar_updated_at,
    updated_at = now();
end;
$$;

revoke execute on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Color del profe elegido por él (misma paleta que lib/profe-colors.ts y 0009)
-- ---------------------------------------------------------------------------
create function public.set_my_profe_color(p_club_id uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_palette text[] := array['#B4235A', '#7A3FB8', '#1F7A4D', '#C2410C', '#0F766E', '#A16207', '#6D4C41', '#475569'];
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa.' using errcode = '42501';
  end if;
  if not (upper(coalesce(p_color, '')) = any(v_palette)) then
    raise exception 'Elegí un color de la paleta.' using errcode = '22023';
  end if;

  update public.memberships
  set color = upper(p_color)
  where club_id = p_club_id and user_id = auth.uid() and role = 'profesor';

  if not found then
    raise exception 'Solo los profes eligen su color en la planilla.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.set_my_profe_color(uuid, text) from public, anon;
grant execute on function public.set_my_profe_color(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Correo confirmado → se copia a las membresías
-- ---------------------------------------------------------------------------
create function public.sync_membership_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
  set email = lower(coalesce(new.email, ''))
  where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_membership_email();
