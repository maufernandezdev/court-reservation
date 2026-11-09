import { getSessionContext } from "@/lib/auth";
import type { Player } from "@/lib/players";
import { PlayersView } from "@/components/players/players-view";

export const metadata = { title: "Jugadores" };

/** Jugadores: la lista se trae en el servidor. */
export default async function PlayersPage() {
  const { supabase, membership } = await getSessionContext();
  if (!membership) return null;

  const { data, error } = await supabase
    .from("players")
    .select("id, club_id, full_name, dni, phone, email, created_by, created_at, updated_at")
    .eq("club_id", membership.club_id)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  return (
    <PlayersView
      players={(data ?? []) as Player[]}
      loadError={error ? "No se pudieron cargar los jugadores." : ""}
    />
  );
}
