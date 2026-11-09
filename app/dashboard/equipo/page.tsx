import { ShieldAlert } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { avatarUrl, type Profile } from "@/lib/profile";
import type { ClubInvitation } from "@/lib/invitations";
import type { MemberWithEmail } from "@/lib/members";
import { TeamView } from "@/components/members/team-view";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Equipo" };

/** Equipo: el permiso, los miembros, sus fotos y las invitaciones se resuelven en el servidor. */
export default async function TeamPage() {
  const { supabase, membership } = await getSessionContext();
  if (!membership) return null;

  if (membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Solo los administradores pueden gestionar el equipo del club.
        </AlertDescription>
      </Alert>
    );
  }

  const clubId = membership.club_id;
  // Abiertas = ni aceptadas ni canceladas (las vencidas se muestran para renovarlas).
  const [{ data: membersData }, { data: invitationsData }] = await Promise.all([
    supabase
      .from("memberships")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true }),
    supabase
      .from("club_invitations")
      .select("id, note, role, created_at, expires_at")
      .eq("club_id", clubId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const members = (membersData ?? []) as MemberWithEmail[];

  // Fotos de perfil del equipo.
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_path, avatar_updated_at")
    .in("user_id", members.map((m) => m.user_id));
  const avatarUrls = Object.fromEntries(
    ((profilesData ?? []) as Profile[]).map((profile) => [profile.user_id, avatarUrl(profile)])
  );

  return (
    <TeamView
      members={members}
      invitations={(invitationsData ?? []) as ClubInvitation[]}
      avatarUrls={avatarUrls}
    />
  );
}
