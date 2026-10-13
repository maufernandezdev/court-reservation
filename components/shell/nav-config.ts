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
import { FEATURES, type Feature } from "@/lib/features";
import { roleAtLeast, type ClubRole } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rol mínimo para ver la sección (sin indicar: todos). */
  minRole?: ClubRole;
  /** Módulo que se puede ocultar con `lib/features.ts`. */
  feature?: Feature;
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
      { href: "/dashboard/caja", label: "Caja", icon: Wallet, minRole: "admin" },
    ],
  },
  {
    label: "Club",
    items: [
      { href: "/dashboard/canchas", label: "Canchas", icon: LandPlot, minRole: "admin" },
      { href: "/dashboard/socios", label: "Socios", icon: Users, minRole: "operador" },
      { href: "/dashboard/miembros", label: "Equipo", icon: IdCard, minRole: "admin" },
      { href: "/dashboard/productos", label: "Productos", icon: Package, minRole: "admin", feature: "products" },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/dashboard/configuracion", label: "Políticas", icon: ShieldCheck, minRole: "admin" },
      { href: "/dashboard/actividad", label: "Actividad", icon: History, minRole: "admin" },
      { href: "/dashboard/reportes", label: "Reportes", icon: ChartColumn, minRole: "admin" },
      { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell, minRole: "admin", feature: "notifications" },
      { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard, minRole: "admin" },
    ],
  },
];

export function visibleGroups(role: ClubRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!item.minRole || roleAtLeast(role, item.minRole)) &&
        (!item.feature || FEATURES[item.feature])
    ),
  })).filter((group) => group.items.length > 0);
}

/** `/dashboard` solo matchea exacto; el resto también sus subrutas. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
