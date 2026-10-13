import { z } from "zod";

/** Nombre propio (perfil y todas las membresías). */
export const profileNameSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Ingresá tu nombre")
    .max(120, "El nombre puede tener hasta 120 caracteres"),
});
export type ProfileNameInput = z.infer<typeof profileNameSchema>;

/** Cambio de contraseña: la actual, y la nueva dos veces (misma regla que el registro). */
export const profilePasswordSchema = z
  .object({
    current: z.string().min(1, "Ingresá tu contraseña actual"),
    password: z.string().min(6, "La contraseña nueva debe tener al menos 6 caracteres"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
export type ProfilePasswordInput = z.infer<typeof profilePasswordSchema>;

/** Correo nuevo. */
export const profileEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un correo válido"),
});
export type ProfileEmailInput = z.infer<typeof profileEmailSchema>;

/** Perfil leído de la tabla `profiles`. */
export type Profile = {
  user_id: string;
  full_name: string;
  avatar_path: string | null;
  avatar_updated_at: string | null;
};

/** URL de la foto servida por la app (con versión para no mostrar una vieja de la caché). */
export function avatarUrl(profile: Pick<Profile, "user_id" | "avatar_path" | "avatar_updated_at"> | null): string | null {
  if (!profile?.avatar_path) return null;
  const version = profile.avatar_updated_at ? new Date(profile.avatar_updated_at).getTime() : 0;
  return `/api/avatars/${profile.user_id}?v=${version}`;
}
