"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { isActivePath, visibleGroups } from "@/components/shell/nav-config";

export type ShellIdentity = {
  clubName: string;
  clubInitials: string;
  roleLabel: string;
  userName: string;
  userEmail: string;
  userInitials: string;
};

type AppSidebarProps = {
  identity: ShellIdentity;
  isAdmin: boolean;
  onLogout: () => void;
};

export function ClubBlock({ identity }: { identity: ShellIdentity }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-foreground/16 bg-sidebar-foreground/4 p-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-foreground font-display text-[11px] font-extrabold text-sidebar font-stretch-[125%]">
        {identity.clubInitials}
      </span>
      <span className="flex min-w-0 flex-col">
        <strong className="truncate text-sm">{identity.clubName}</strong>
        <span className="text-[13px] text-sidebar-label">{identity.roleLabel}</span>
      </span>
    </div>
  );
}

export function UserBlock({
  identity,
  onLogout,
}: {
  identity: ShellIdentity;
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-sidebar-foreground/12 px-2 pt-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-line text-[13px] font-bold text-line-foreground">
        {identity.userInitials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-sm">{identity.userName}</strong>
        {identity.userName !== identity.userEmail && (
          <span className="truncate text-[13px] text-sidebar-label">
            {identity.userEmail}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ball"
      >
        <LogOut className="size-[18px]" />
      </button>
    </div>
  );
}

export function NavGroups({
  isAdmin,
  onNavigate,
}: {
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-5">
      {visibleGroups(isAdmin).map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className="mb-1 px-3 font-mono text-xs tracking-[0.06em] text-sidebar-label uppercase">
            {group.label}
          </span>
          {group.items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-[9px] px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball",
                  active
                    ? "bg-ball font-semibold text-ball-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Menú lateral oscuro del panel en escritorio (ver artboards Hoy/Planilla). */
export function AppSidebar({ identity, isAdmin, onLogout }: AppSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto bg-sidebar px-3.5 py-5 text-sidebar-foreground lg:flex">
      <Link
        href="/dashboard"
        className="rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-ball"
      >
        <Logo size="sm" />
      </Link>
      <ClubBlock identity={identity} />
      <NavGroups isAdmin={isAdmin} />
      <div className="mt-auto">
        <UserBlock identity={identity} onLogout={onLogout} />
      </div>
    </aside>
  );
}
