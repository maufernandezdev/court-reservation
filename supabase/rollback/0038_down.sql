-- Deshace 0038_player_sync.
drop trigger if exists players_sync_copies on public.players;
drop function if exists public.sync_player_copies();
