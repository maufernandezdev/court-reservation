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
