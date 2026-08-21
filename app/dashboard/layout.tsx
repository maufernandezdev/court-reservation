"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AuthGuard from "@/components/auth-guard";
import { CLUB_NAME } from "@/lib/mocks/data";
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
} from "lucide-react";

const navItems = [
  { href: "/dashboard/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/dashboard/socios", label: "Socios", icon: Users },
  { href: "/dashboard/productos", label: "Productos", icon: Package },
  { href: "/dashboard/caja", label: "Caja", icon: DollarSign },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard },
];

function SidebarContent() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3 px-2 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Club className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold leading-tight">{CLUB_NAME}</span>
          <span className="text-xs text-muted-foreground">Panel de administración</span>
        </div>
      </div>

      <Separator />

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
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
  const { logout } = useAuth();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/20">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Club className="h-4 w-4" />
          </div>
          <span className="font-semibold">{CLUB_NAME}</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-card p-4 lg:flex">
          <SidebarContent />
          <div className="mt-auto flex items-center gap-3 pt-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">OP</AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">Operador</span>
              <span className="text-xs text-muted-foreground">Admin</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8">
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
