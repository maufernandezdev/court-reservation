import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getSessionContext } from "@/lib/auth";
import { avatarUrl, type Profile } from "@/lib/profile";
import { fetchSubscriptionInfo, subscriptionNotice } from "@/lib/subscription";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_path, avatar_updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const subscription = await fetchSubscriptionInfo(supabase, membership.club_id);
  const notice = subscriptionNotice(subscription, membership.role === "admin");

  return (
    <DashboardShell
      membership={membership}
      memberships={memberships}
      avatarUrl={avatarUrl(profile as Profile | null)}
      notice={notice}
    >
      {children}
    </DashboardShell>
  );
}
