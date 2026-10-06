"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMembership } from "@/hooks/use-membership";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AuthGuard from "@/components/auth-guard";
import { CLUB_NAME } from "@/lib/mocks/data";
import { CLUB_ROLE_LABELS } from "@/lib/roles";
import {
  CalendarDays,
  Users,
  Package,
  DollarSign,
  BarChart3,
  Bell,
  CreditCard,
  LogOut,
  Menu,
  Club,
  LandPlot,
  UserCog,
  Settings2,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LandPlot;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/dashboard/canchas", label: "Canchas", icon: LandPlot, adminOnly: true },
  { href: "/dashboard/miembros", label: "Miembros", icon: UserCog, adminOnly: true },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings2, adminOnly: true },
  { href: "/dashboard/socios", label: "Socios", icon: Users, adminOnly: true },
  { href: "/dashboard/productos", label: "Productos", icon: Package, adminOnly: true },
  { href: "/dashboard/caja", label: "Caja", icon: DollarSign, adminOnly: true },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell, adminOnly: true },
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard, adminOnly: true },
];

function SidebarContent({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col gap-4">
      <Link href="/dashboard" className="flex items-center gap-3 rounded-md px-2 py-4 transition-colors hover:bg-accent">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Club className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold leading-tight">{CLUB_NAME}</span>
          <span className="text-xs text-muted-foreground">Panel de administración</span>
        </div>
      </Link>

      <Separator />

      <nav className="flex flex-col gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase() || "??";
  const isAdmin = membership?.role === "admin";
  const roleLabel = membership
    ? CLUB_ROLE_LABELS[membership.role]
    : isLoadingMembership
      ? "..."
      : "Usuario";

  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/20">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Club className="h-4 w-4" />
          </div>
          <span className="font-semibold">{CLUB_NAME}</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SidebarContent isAdmin={isAdmin} />
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card p-4 lg:flex">
          <SidebarContent isAdmin={isAdmin} />
          <div className="mt-auto flex items-center gap-3 pt-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{email || "Usuario"}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <div className="mb-4 flex items-center justify-end lg:hidden">
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
          {children}
        </main>
      </div>
    </div>
    </AuthGuard>
  );
}
