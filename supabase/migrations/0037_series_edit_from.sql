-- Editar un fijo desde una fecha (#7).
-- `update_series_from`: al editar una fecha de un fijo con "Esta y las siguientes", copia cancha,
--    hora, duración, tipo, profe y personas al fijo y a sus fechas futuras activas sin cobros. Si una
--    fecha choca con otro turno no cambia nada (todo o nada) y avisa qué fecha choca.

create or replace function public.update_series_from(p_reservation_id uuid)
returns table (updated_count int, kept_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
  s public.reservation_series%rowtype;
  f record;
  v_people jsonb;
  v_updated int := 0;
  v_kept int := 0;
begin
  select * into r from public.reservations where id = p_reservation_id;
  if not found or r.series_id is null then
    raise exception 'El turno no es parte de un fijo.' using errcode = 'P0001';
  end if;
  select * into s from public.reservation_series where id = r.series_id for update;

  if not (public.is_staff(r.club_id) or (s.kind = 'profe' and s.profe_user_id = auth.uid())) then
    raise exception 'No podés modificar este fijo.' using errcode = '42501';
  end if;
  if extract(dow from r.date)::int <> s.weekday then
    raise exception 'Para cambiar el día de la semana de un fijo, dalo de baja y creá uno nuevo.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'player_id', p.player_id) order by p.position), '[]'::jsonb)
  into v_people
  from public.reservation_participants p where p.reservation_id = r.id;

  update public.reservation_series
  set court_id = r.court_id,
      start_time = r.time,
      duration_minutes = r.duration_minutes,
      kind = r.kind,
      profe_user_id = r.profe_user_id,
      customer_name = r.customer_name,
      phone = r.phone,
      participants = v_people
  where id = s.id;

  for f in
    select fr.id, fr.date
    from public.reservations fr
    where fr.series_id = s.id
      and fr.date > r.date
      and fr.status in ('active', 'pending_approval')
    order by fr.date
  loop
    if exists (select 1 from public.payments p where p.reservation_id = f.id and not p.released) then
      v_kept := v_kept + 1;
      continue;
    end if;
    begin
      update public.reservations fr
      set court_id = r.court_id,
          time = r.time,
          duration_minutes = r.duration_minutes,
          kind = r.kind,
          profe_user_id = r.profe_user_id,
          customer_name = r.customer_name,
          phone = r.phone,
          price = case fr.pricing_mode
            when 'lista' then public.list_price_for(r.court_id, r.kind, r.time, r.duration_minutes)
            else fr.price
          end,
          updated_by = auth.uid()
      where fr.id = f.id;
    exception when exclusion_violation or unique_violation then
      raise exception 'El % la cancha ya está ocupada en ese horario: no se cambió ninguna fecha.',
        to_char(f.date, 'DD/MM') using errcode = 'P0001';
    end;

    delete from public.reservation_participants where reservation_id = f.id;
    insert into public.reservation_participants (club_id, reservation_id, position, player_id, name)
    select r.club_id, f.id, p.position, p.player_id, p.name
    from public.reservation_participants p where p.reservation_id = r.id;

    v_updated := v_updated + 1;
  end loop;

  insert into public.audit_log (club_id, actor_id, entity, entity_id, action, payload)
  values (r.club_id, auth.uid(), 'series', s.id, 'series.updated_from',
    jsonb_build_object('from', r.date, 'time', r.time, 'duration', r.duration_minutes,
      'updated', v_updated, 'kept', v_kept));

  updated_count := v_updated;
  kept_count := v_kept;
  return next;
end;
$$;

revoke all on function public.update_series_from(uuid) from public, anon;
grant execute on function public.update_series_from(uuid) to authenticated;
