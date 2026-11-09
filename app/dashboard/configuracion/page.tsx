import { ShieldAlert } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { loadClubDataSeed } from "@/lib/club-data-server";
import { ClubDataProvider } from "@/components/club/club-data-provider";
import { PoliciesView } from "@/components/club/policies-view";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Políticas" };

/** Políticas del club: el permiso y los datos se resuelven en el servidor. */
export default async function PoliciesPage() {
  const { supabase, membership } = await getSessionContext();
  if (!membership) return null;

  if (membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Solo los administradores pueden configurar las políticas del club.
        </AlertDescription>
      </Alert>
    );
  }

  const seed = await loadClubDataSeed(supabase, membership.club_id);

  return (
    <ClubDataProvider value={seed}>
      <PoliciesView />
    </ClubDataProvider>
  );
}
