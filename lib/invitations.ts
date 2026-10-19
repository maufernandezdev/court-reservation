import { z } from "zod";
import { PRODUCT_NAME } from "@/lib/brand";
import type { ClubRole } from "@/lib/roles";

/** Invitación abierta tal como la ve el admin en Equipo (sin el hash del token). */
export type ClubInvitation = {
  id: string;
  /** "Para quién es" (opcional): solo para reconocerla en la lista. */
  note: string;
  role: ClubRole;
  created_at: string;
  expires_at: string;
};

/** Lo que devuelve `get_invitation` para la pantalla pública del link. */
export type InvitationLookup = {
  status: "pending" | "expired" | "accepted" | "revoked" | "invalid";
  club_name: string | null;
  role: ClubRole | null;
  note: string | null;
  expires_at: string | null;
};

/** Link listo para compartir (el token solo existe en este momento: en la base queda su hash). */
export type SharedInvitation = {
  link: string;
  note: string;
  role: ClubRole;
  expiresAt: string;
};

/** El token viaja en la URL: 32 bytes aleatorios en base64url. */
export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, "El link de invitación no es válido.");

/** Datos de la persona que se suma desde el link (cuenta nueva o existente). */
const joinFields = {
  token: invitationTokenSchema,
  email: z.string().trim().email("Ingresá un correo válido").max(254, "El correo es demasiado largo"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
};

/** Cuenta nueva: nombre, correo y contraseña (misma regla de contraseña que el registro). */
export const joinNewAccountSchema = z.object({
  ...joinFields,
  full_name: z.string().trim().min(1, "Ingresá tu nombre").max(120, "El nombre puede tener hasta 120 caracteres"),
});

/** Cuenta existente: correo y contraseña. */
export const joinExistingAccountSchema = z.object(joinFields);

export type JoinNewAccountInput = z.infer<typeof joinNewAccountSchema>;
export type JoinExistingAccountInput = z.infer<typeof joinExistingAccountSchema>;

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

/** Texto que se manda por WhatsApp: no lleva nombre ni correo, quien lo abre los carga. */
export function invitationMessage({
  clubName,
  roleLabel,
  link,
  expiresAt,
}: {
  clubName: string;
  roleLabel: string;
  link: string;
  expiresAt: string;
}): string {
  return [
    `¡Hola! Te invito a sumarte a ${clubName} en ${PRODUCT_NAME} como ${roleLabel.toLowerCase()}.`,
    `Entrá desde este link y cargá tus datos: ${link}`,
    `(sirve una sola vez y vence el ${shortDate(expiresAt)})`,
  ].join("\n");
}

/** wa.me sin número: WhatsApp deja elegir el contacto. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
