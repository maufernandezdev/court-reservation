-- Vuelta atrás de 0019_profe_players.sql: solo el staff agrega y modifica jugadores.
drop policy "players_insert_member" on public.players;
drop policy "players_update_staff_or_creator" on public.players;

create policy "players_insert_staff" on public.players
  for insert to authenticated
  with check (is_staff(club_id));

create policy "players_update_staff" on public.players
  for update to authenticated
  using (is_staff(club_id))
  with check (is_staff(club_id));
