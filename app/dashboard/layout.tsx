"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMembership } from "@/hooks/use-membership";
import AuthGuard from "@/components/auth-guard";
import { AppSidebar, type ShellIdentity } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { CLUB_NAME } from "@/lib/mocks/data";
import { CLUB_ROLE_LABELS } from "@/lib/roles";

function initialsOf(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "??";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const email = user?.email ?? "";
  const userName = membership?.full_name?.trim() || email || "Usuario";
  const isAdmin = membership?.role === "admin";

  const identity: ShellIdentity = {
    clubName: CLUB_NAME,
    clubInitials: CLUB_NAME.split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase(),
    roleLabel: membership
      ? CLUB_ROLE_LABELS[membership.role]
      : isLoadingMembership
        ? "…"
        : "Usuario",
    userName,
    userEmail: email,
    userInitials: initialsOf(userName),
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <AppSidebar identity={identity} isAdmin={isAdmin} onLogout={logout} />
        <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          {children}
        </main>
        <MobileTabBar identity={identity} isAdmin={isAdmin} onLogout={logout} />
      </div>
    </AuthGuard>
  );
}
