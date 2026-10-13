-- Color automático para cada profe: al sumarse como profesor (invitación) o al pasar
-- a profesor (cambio de rol), si no tiene color se le asigna el primero libre de la
-- paleta en su club (misma paleta que lib/profe-colors.ts). Cubre todos los caminos,
-- incluso cuando quien dispara el cambio no es admin.

create function public.assign_profe_color()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_palette text[] := array['#B4235A', '#7A3FB8', '#1F7A4D', '#C2410C', '#0F766E', '#A16207', '#6D4C41', '#475569'];
  v_used text[];
  v_count int;
  i int;
begin
  if new.role <> 'profesor' or new.color is not null then
    return new;
  end if;

  select coalesce(array_agg(color), '{}'), count(*)
  into v_used, v_count
  from public.memberships
  where club_id = new.club_id and role = 'profesor' and color is not null and id <> new.id;

  for i in 1..array_length(v_palette, 1) loop
    if not (v_palette[i] = any(v_used)) then
      new.color := v_palette[i];
      return new;
    end if;
  end loop;

  -- Todos usados: se repite en orden.
  new.color := v_palette[(v_count % array_length(v_palette, 1)) + 1];
  return new;
end;
$$;

create trigger memberships_assign_profe_color
before insert or update of role on public.memberships
for each row execute function public.assign_profe_color();
