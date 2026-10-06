export const CLUB_ROLES = ["admin", "operador", "profesor"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const CLUB_ROLE_LABELS: Record<ClubRole, string> = {
  admin: "Administrador",
  operador: "Operador",
  profesor: "Profesor",
};

export type Membership = {
  id: string;
  owner_id: string;
  user_id: string;
  role: ClubRole;
  full_name: string;
  email: string;
  created_at: string;
};

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
