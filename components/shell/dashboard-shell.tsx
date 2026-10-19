"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AuthGuard from "@/components/auth-guard";
import { AppSidebar, type ShellIdentity } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { ActiveClubProvider } from "@/components/shell/active-club-provider";
import { CLUB_ROLE_LABELS, clubInitials, clubLogoUrl, type Membership } from "@/lib/roles";
import type { SubscriptionNotice } from "@/lib/subscription";

function initialsOf(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "??";
}

type DashboardShellProps = {
  membership: Membership;
  memberships: Membership[];
  /** Foto de perfil servida por la app, o null. */
  avatarUrl: string | null;
  /** Aviso de la suscripción del club (prueba por terminar, gracia o vencida), o null. */
  notice: SubscriptionNotice | null;
  children: React.ReactNode;
};

export function DashboardShell({ membership, memberships, avatarUrl, notice, children }: DashboardShellProps) {
  const { user, logout } = useAuth();
  const email = user?.email ?? membership.email;
  const userName = membership.full_name.trim() || email || "Usuario";
  const isAdmin = membership.role === "admin";

  const identity: ShellIdentity = {
    clubName: membership.club.name,
    clubInitials: clubInitials(membership.club.name),
    clubLogoUrl: clubLogoUrl(membership.club),
    roleLabel: CLUB_ROLE_LABELS[membership.role],
    userName,
    userEmail: email,
    userInitials: initialsOf(userName),
    avatarUrl,
  };

  return (
    <AuthGuard>
      <ActiveClubProvider membership={membership} memberships={memberships}>
        <div className="flex min-h-screen bg-background">
          <AppSidebar identity={identity} isAdmin={isAdmin} onLogout={logout} />
          <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
            {notice && (
              <Alert
                variant={notice.tone === "destructive" ? "destructive" : "default"}
                className="mb-6"
                data-testid="subscription-notice"
              >
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>
                  {notice.message}
                  {isAdmin && (
                    <>
                      {" "}
                      <Link href="/dashboard/suscripcion" className="font-medium underline underline-offset-4">
                        Ver suscripción
                      </Link>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {children}
          </main>
          <MobileTabBar identity={identity} isAdmin={isAdmin} onLogout={logout} />
        </div>
      </ActiveClubProvider>
    </AuthGuard>
  );
}
