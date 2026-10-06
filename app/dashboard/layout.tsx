import { DashboardShell } from "@/components/shell/dashboard-shell";

// Todo el panel depende de la sesión del usuario (cookies/Supabase):
// no se puede prerenderizar estáticamente en el build.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
