import { z } from "zod";
import { CLUB_ROLES, type ClubRole } from "@/lib/roles";

export const memberInviteSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido"),
  full_name: z.string().trim().min(1, "Ingresá el nombre del miembro"),
  role: z.enum(CLUB_ROLES, { message: "Seleccioná un rol" }),
});

export type MemberInviteInput = z.infer<typeof memberInviteSchema>;

export const memberRoleSchema = z.object({
  role: z.enum(CLUB_ROLES, { message: "Seleccioná un rol" }),
});

export type MemberWithEmail = {
  id: string;
  owner_id: string;
  user_id: string;
  role: ClubRole;
  full_name: string;
  email: string;
  created_at: string;
};
