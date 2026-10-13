"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Grid3x3,
  LayoutDashboard,
  Menu,
  Search,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { isActivePath } from "@/components/shell/nav-config";
import {
  ClubBlock,
  NavGroups,
  UserBlock,
  type ShellIdentity,
} from "@/components/shell/app-sidebar";

type TabItem = { href: string; label: string; icon: LucideIcon; match?: string };

type MobileTabBarProps = {
  identity: ShellIdentity;
  isAdmin: boolean;
  onLogout: () => void;
};

const tabClass =
  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-ball";

/** Barra inferior del panel en celular (< lg). "Más" abre el resto del menú. */
export function MobileTabBar({ identity, isAdmin, onLogout }: MobileTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs: TabItem[] = [
    { href: "/dashboard", label: "Hoy", icon: LayoutDashboard },
    { href: "/dashboard/reservas", label: "Planilla", icon: Grid3x3 },
    { href: "/dashboard/reservas?buscar=1", label: "Buscar", icon: Search, match: "__never__" },
    ...(isAdmin
      ? [{ href: "/dashboard/caja", label: "Caja", icon: Wallet }]
      : []),
  ];

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 bg-sidebar px-1.5 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)] text-sidebar-foreground lg:hidden"
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.match ?? tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                tabClass,
                active ? "font-bold text-ball" : "text-sidebar-label"
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.8} />
              {tab.label}
            </Link>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button type="button" className={cn(tabClass, "text-sidebar-label")}>
              <Menu className="size-[22px]" strokeWidth={1.8} />
              Más
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-[300px] flex-col gap-5 overflow-y-auto border-none bg-sidebar px-3.5 py-5 text-sidebar-foreground [&>button]:text-sidebar-foreground"
          >
            <SheetTitle className="px-2 text-sidebar-foreground">
              <Logo size="sm" />
            </SheetTitle>
            <SheetDescription className="sr-only">
              Secciones del panel, club y sesión
            </SheetDescription>
            <ClubBlock identity={identity} />
            <NavGroups onNavigate={() => setMoreOpen(false)} />
            <div className="mt-auto">
              <UserBlock identity={identity} onLogout={onLogout} onNavigate={() => setMoreOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
