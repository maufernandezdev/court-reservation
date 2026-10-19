export const CLUB_ROLES = ["admin", "operador", "profesor"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const CLUB_ROLE_LABELS: Record<ClubRole, string> = {
  admin: "Administrador",
  operador: "Operador",
  profesor: "Profesor",
};

export type Club = {
  id: string;
  name: string;
  city: string;
  /** Ruta del logo en R2 (null si el admin no lo subió). */
  logo_path?: string | null;
  logo_updated_at?: string | null;
};

/** URL del logo servida por la app (con versión para no mostrar uno viejo de la caché), o null. */
export function clubLogoUrl(club: Pick<Club, "id" | "logo_path" | "logo_updated_at">): string | null {
  if (!club.logo_path) return null;
  const version = club.logo_updated_at ? new Date(club.logo_updated_at).getTime() : 0;
  return `/api/clubs/${club.id}/logo?v=${version}`;
}

export type Membership = {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  full_name: string;
  email: string;
  /** Color en la planilla (solo profesores). */
  color: string | null;
  created_at: string;
  club: Club;
};

/** Cookie con el id del club activo (no es secreta: el RLS sigue protegiendo los datos). */
export const ACTIVE_CLUB_COOKIE = "club_activo";

/** Iniciales para el bloque del club en el menú ("Club Deportivo Central" → "CDC"). */
export function clubInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "?"
  );
}

const ROLE_RANK: Record<ClubRole, number> = {
  admin: 3,
  operador: 2,
  profesor: 1,
};

/** `role` alcanza al menos el nivel `minimum` (admin > operador > profesor). */
export function roleAtLeast(role: ClubRole, minimum: ClubRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Qué puede hacer cada rol: `true`, `false` o un texto corto cuando es con condiciones. */
export type RoleCapability = {
  label: string;
  access: Record<ClubRole, boolean | string>;
};

/**
 * Matriz de permisos que se muestra en Equipo. Tiene que reflejar lo que
 * aplican las Server Actions (`requireRole`) y las reglas de cancelación.
 */
export const ROLE_CAPABILITIES: RoleCapability[] = [
  { label: "Ver la planilla", access: { admin: true, operador: true, profesor: true } },
  { label: "Crear y mover turnos", access: { admin: true, operador: true, profesor: true } },
  {
    label: "Cancelar en término",
    access: { admin: true, operador: true, profesor: "Sin cobros" },
  },
  { label: "Cancelar fuera de término", access: { admin: true, operador: true, profesor: false } },
  { label: "Registrar cobros y señas", access: { admin: true, operador: true, profesor: false } },
  { label: "Ver caja y reportes", access: { admin: true, operador: false, profesor: false } },
  { label: "Canchas, precios y políticas", access: { admin: true, operador: false, profesor: false } },
  { label: "Invitar y cambiar roles", access: { admin: true, operador: false, profesor: false } },
];
