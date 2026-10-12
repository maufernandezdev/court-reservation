import { z } from "zod";
import { PRODUCT_NAME } from "@/lib/brand";
import type { ClubRole } from "@/lib/roles";

/** Invitación abierta tal como la ve el admin en Equipo (sin el hash del token). */
export type ClubInvitation = {
  id: string;
  email: string;
  full_name: string;
  role: ClubRole;
  created_at: string;
  expires_at: string;
};

/** Lo que devuelve `get_invitation` para la pantalla pública del link. */
export type InvitationLookup = {
  status: "pending" | "expired" | "accepted" | "revoked" | "invalid";
  club_name: string | null;
  role: ClubRole | null;
  email: string | null;
  full_name: string | null;
  expires_at: string | null;
  has_account: boolean | null;
};

/** Link listo para compartir (el token solo existe en este momento: en la base queda su hash). */
export type SharedInvitation = {
  link: string;
  email: string;
  fullName: string;
  role: ClubRole;
  expiresAt: string;
};

/** El token viaja en la URL: 32 bytes aleatorios en base64url. */
export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, "El link de invitación no es válido.");

/** Ingreso desde el link: misma regla de contraseña que el registro. */
export const joinInvitationSchema = z.object({
  token: invitationTokenSchema,
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type JoinInvitationInput = z.infer<typeof joinInvitationSchema>;

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() < now.getTime();
}

/** "19/10" en hora de Argentina. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/** Texto que se manda por WhatsApp o se pega en un correo. */
export function invitationMessage({
  fullName,
  clubName,
  roleLabel,
  email,
  link,
  expiresAt,
}: {
  fullName: string;
  clubName: string;
  roleLabel: string;
  email: string;
  link: string;
  expiresAt: string;
}): string {
  const firstName = fullName.trim().split(/\s+/)[0];
  return [
    `Hola${firstName ? ` ${firstName}` : ""}, te invito a sumarte a ${clubName} en ${PRODUCT_NAME} como ${roleLabel.toLowerCase()}.`,
    `Entrá con tu correo ${email} desde este link: ${link}`,
    `(vence el ${shortDate(expiresAt)})`,
  ].join("\n");
}

/** wa.me sin número: WhatsApp deja elegir el contacto. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
