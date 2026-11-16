import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getSessionContext } from "@/lib/auth";
import { avatarUrl, type Profile } from "@/lib/profile";
import { fetchSubscriptionInfo, subscriptionNotice } from "@/lib/subscription";
import { clubTodayKey } from "@/lib/club-time";

// Todo el panel depende de la sesión del usuario (cookies/Supabase):
// no se puede prerenderizar estáticamente en el build.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, membership, memberships } = await getSessionContext();

  if (!user) {
    redirect("/login");
  }

  // Sin club todavía: elegir entre crear uno o esperar una invitación.
  if (!membership) {
    redirect("/bienvenida");
  }

  // Perfil y suscripción no dependen entre sí: en paralelo.
  // Contador de "Para confirmar" en el menú: solo el admin confirma horarios.
  const pendingQuery =
    membership.role === "admin"
      ? supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("club_id", membership.club_id)
          .eq("status", "pending_approval")
          .gte("date", clubTodayKey())
      : Promise.resolve({ count: 0 });
  const [{ data: profile }, subscription, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_path, avatar_updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    fetchSubscriptionInfo(supabase, membership.club_id),
    pendingQuery,
  ]);
  const notice = subscriptionNotice(subscription, membership.role === "admin");

  return (
    <DashboardShell
      membership={membership}
      memberships={memberships}
      avatarUrl={avatarUrl(profile as Profile | null)}
      notice={notice}
      pendingApprovals={pendingApprovals ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
