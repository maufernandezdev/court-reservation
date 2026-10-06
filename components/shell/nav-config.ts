import {
  ChartColumn,
  Bell,
  CreditCard,
  Grid3x3,
  History,
  IdCard,
  LandPlot,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * Navegación del panel (menú lateral y "Más" del celular). Las rutas son las
 * históricas; solo cambian los rótulos (ver specs/app-shell).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/dashboard", label: "Hoy", icon: LayoutDashboard },
      { href: "/dashboard/reservas", label: "Planilla", icon: Grid3x3 },
      { href: "/dashboard/caja", label: "Caja", icon: Wallet, adminOnly: true },
    ],
  },
  {
    label: "Club",
    items: [
      { href: "/dashboard/canchas", label: "Canchas", icon: LandPlot, adminOnly: true },
      { href: "/dashboard/socios", label: "Socios", icon: Users, adminOnly: true },
      { href: "/dashboard/miembros", label: "Equipo", icon: IdCard, adminOnly: true },
      { href: "/dashboard/productos", label: "Productos", icon: Package, adminOnly: true },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/dashboard/configuracion", label: "Políticas", icon: ShieldCheck, adminOnly: true },
      { href: "/dashboard/actividad", label: "Actividad", icon: History, adminOnly: true },
      { href: "/dashboard/reportes", label: "Reportes", icon: ChartColumn, adminOnly: true },
      { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell, adminOnly: true },
      { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard, adminOnly: true },
    ],
  },
];

export function visibleGroups(isAdmin: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0);
}

/** `/dashboard` solo matchea exacto; el resto también sus subrutas. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
