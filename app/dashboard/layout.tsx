import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getSessionContext } from "@/lib/auth";

// Todo el panel depende de la sesión del usuario (cookies/Supabase):
// no se puede prerenderizar estáticamente en el build.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership, memberships } = await getSessionContext();

  if (!user) {
    redirect("/login");
  }

  // Sin club todavía: elegir entre crear uno o esperar una invitación.
  if (!membership) {
    redirect("/bienvenida");
  }

  return (
    <DashboardShell membership={membership} memberships={memberships}>
      {children}
    </DashboardShell>
  );
}
