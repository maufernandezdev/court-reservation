"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PROFE_COLOR_VALUES } from "@/lib/profe-colors";
import {
  profileEmailSchema,
  profileNameSchema,
  profilePasswordSchema,
  type ProfileEmailInput,
  type ProfileNameInput,
  type ProfilePasswordInput,
} from "@/lib/profile";

type Result = { success: boolean; error?: string };

/** Nombre propio: se actualiza el perfil y todas las membresías (menú, Equipo, Actividad). */
export async function updateMyNameAction(input: ProfileNameInput): Promise<Result> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_name", { p_full_name: parsed.data.full_name });
  if (error) {
    return { success: false, error: error.code === "22023" ? error.message : "No se pudo guardar tu nombre." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

/** Cambio de contraseña verificando la actual. */
export async function changePasswordAction(input: ProfilePasswordInput): Promise<Result> {
  const parsed = profilePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: "Tu sesión venció. Ingresá de nuevo." };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (signInError) {
    return { success: false, error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      success: false,
      error:
        error.code === "same_password"
          ? "La contraseña nueva tiene que ser distinta de la actual."
          : error.code === "weak_password"
            ? "La contraseña nueva es demasiado débil."
            : "No se pudo cambiar la contraseña.",
    };
  }

  return { success: true };
}

/**
 * Pedido de cambio de correo: Supabase manda el link de confirmación y, hasta
 * confirmarlo, el correo anterior sigue siendo el válido.
 */
export async function changeEmailAction(input: ProfileEmailInput): Promise<Result> {
  const parsed = profileEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Tu sesión venció. Ingresá de nuevo." };
  }
  if (user.email?.toLowerCase() === parsed.data.email) {
    return { success: false, error: "Ese ya es tu correo." };
  }

  const h = await headers();
  const origin =
    h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${origin}/dashboard/perfil?correo=confirmado` }
  );
  if (error) {
    return {
      success: false,
      error:
        error.code === "email_exists"
          ? "Ese correo ya lo usa otra cuenta."
          : error.code === "over_email_send_rate_limit"
            ? "Se mandaron demasiados correos. Probá de nuevo en un rato."
            : "No se pudo pedir el cambio de correo.",
    };
  }

  revalidatePath("/dashboard/perfil");
  return { success: true };
}

/** Color del profe en la planilla de un club (solo si es profe ahí). */
export async function setMyProfeColorAction(clubId: string, color: string): Promise<Result> {
  const parsed = z
    .object({ clubId: z.string().uuid(), color: z.enum(PROFE_COLOR_VALUES) })
    .safeParse({ clubId, color });
  if (!parsed.success) {
    return { success: false, error: "Elegí un color de la paleta." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_profe_color", {
    p_club_id: parsed.data.clubId,
    p_color: parsed.data.color,
  });
  if (error) {
    return { success: false, error: error.code === "42501" || error.code === "22023" ? error.message : "No se pudo cambiar el color." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
