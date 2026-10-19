import { z } from "zod";
import { CLUB_ROLES, type ClubRole } from "@/lib/roles";

/** Roles con los que se puede invitar por link: un administrador se suma como operador y se asciende después. */
export const INVITABLE_ROLES = ["operador", "profesor"] as const satisfies readonly ClubRole[];

export const NOTE_MAX_LENGTH = 80;

/** Invitación por link: solo el rol y una nota opcional ("Para quién es") para reconocerla en la lista. */
export const memberInviteSchema = z.object({
  role: z.enum(INVITABLE_ROLES, { message: "Elegí operador o profesor" }),
  note: z.string().trim().max(NOTE_MAX_LENGTH, `La nota puede tener hasta ${NOTE_MAX_LENGTH} caracteres`),
});

export type MemberInviteInput = z.infer<typeof memberInviteSchema>;

export const memberRoleSchema = z.object({
  role: z.enum(CLUB_ROLES, { message: "Seleccioná un rol" }),
});

export type MemberWithEmail = {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  full_name: string;
  email: string;
  /** Color en la planilla (solo profesores). */
  color: string | null;
  created_at: string;
};
