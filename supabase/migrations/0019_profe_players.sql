-- Jugadores para profesores: cualquier miembro del club puede agregar jugadores (sus alumnos) y el
-- profesor modifica o da de baja solo los que agregó él; el staff (admin y operador) gestiona todos.
-- Leer ya estaba abierto a los miembros (el profe los busca al reservar).
-- `supabase db push` corre cada migración dentro de una transacción.

drop policy "players_insert_staff" on public.players;
drop policy "players_update_staff" on public.players;

create policy "players_insert_member" on public.players
  for insert to authenticated
  with check (is_member(club_id) and created_by = auth.uid());

create policy "players_update_staff_or_creator" on public.players
  for update to authenticated
  using (is_staff(club_id) or (is_member(club_id) and created_by = auth.uid()))
  with check (is_staff(club_id) or (is_member(club_id) and created_by = auth.uid()));
