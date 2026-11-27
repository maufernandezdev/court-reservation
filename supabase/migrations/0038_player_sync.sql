-- Al cambiar el nombre o el teléfono de un jugador, se actualizan sus copias en los turnos (personas y
-- quien reserva) y en los fijos (#16). Los turnos guardan el nombre como texto, por eso hace falta copiarlo.
-- Solo toca turnos y fijos vinculados a ese jugador (player_id); el teléfono vacío no pisa uno cargado.
create or replace function public.sync_player_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.full_name is not distinct from old.full_name and new.phone is not distinct from old.phone then
    return new;
  end if;

  update public.reservation_participants
  set name = new.full_name
  where player_id = new.id and name is distinct from new.full_name;

  -- Quien reserva (persona 1) es este jugador.
  update public.reservations res
  set customer_name = new.full_name,
      phone = case when coalesce(new.phone, '') <> '' then new.phone else res.phone end
  from public.reservation_participants p
  where p.reservation_id = res.id
    and p.position = 1
    and p.player_id = new.id
    and res.kind <> 'profe'
    and (res.customer_name is distinct from new.full_name
         or (coalesce(new.phone, '') <> '' and res.phone is distinct from new.phone));

  update public.reservation_series s
  set participants = (
        select jsonb_agg(
                 case when e ->> 'player_id' = new.id::text
                      then jsonb_set(e, '{name}', to_jsonb(new.full_name))
                      else e end
                 order by ord)
        from jsonb_array_elements(s.participants) with ordinality as x(e, ord)
      ),
      customer_name = case
        when s.kind <> 'profe' and s.participants -> 0 ->> 'player_id' = new.id::text then new.full_name
        else s.customer_name end,
      phone = case
        when s.kind <> 'profe' and s.participants -> 0 ->> 'player_id' = new.id::text and coalesce(new.phone, '') <> ''
          then new.phone
        else s.phone end
  where s.club_id = new.club_id
    and s.participants @> jsonb_build_array(jsonb_build_object('player_id', new.id::text));

  return new;
end;
$$;

drop trigger if exists players_sync_copies on public.players;
create trigger players_sync_copies
after update of full_name, phone on public.players
for each row execute function public.sync_player_copies();
