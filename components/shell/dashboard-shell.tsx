"use client";

import { useAuth } from "@/hooks/use-auth";
import AuthGuard from "@/components/auth-guard";
import { AppSidebar, type ShellIdentity } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { ActiveClubProvider } from "@/components/shell/active-club-provider";
import { CLUB_ROLE_LABELS, clubInitials, type Membership } from "@/lib/roles";

function initialsOf(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "??";
}

type DashboardShellProps = {
  membership: Membership;
  memberships: Membership[];
  children: React.ReactNode;
};

export function DashboardShell({ membership, memberships, children }: DashboardShellProps) {
  const { user, logout } = useAuth();
  const email = user?.email ?? membership.email;
  const userName = membership.full_name.trim() || email || "Usuario";
  const isAdmin = membership.role === "admin";

  const identity: ShellIdentity = {
    clubName: membership.club.name,
    clubInitials: clubInitials(membership.club.name),
    roleLabel: CLUB_ROLE_LABELS[membership.role],
    userName,
    userEmail: email,
    userInitials: initialsOf(userName),
  };

  return (
    <AuthGuard>
      <ActiveClubProvider membership={membership} memberships={memberships}>
        <div className="flex min-h-screen bg-background">
          <AppSidebar identity={identity} isAdmin={isAdmin} onLogout={logout} />
          <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
            {children}
          </main>
          <MobileTabBar identity={identity} isAdmin={isAdmin} onLogout={logout} />
        </div>
      </ActiveClubProvider>
    </AuthGuard>
  );
}
