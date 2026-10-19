"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clubOnboardingSchema, type ClubOnboardingInput } from "@/lib/clubs";
import { getSessionContext, setActiveClubCookie } from "@/lib/auth";

type ActionResult = { success: false; error: string };

/** Mensajes de validación de las funciones de la base (código 22023 o P0001) se muestran tal cual. */
function dbMessage(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "22023" || error.code === "P0001" || error.code === "42501"
    ? error.message
    : fallback;
}

/** Paso 2 de 3: crea el club con sus canchas y lleva a Canchas (paso 3). */
export async function createClubAction(input: ClubOnboardingInput): Promise<ActionResult> {
  const parsed = clubOnboardingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { supabase, user, memberships } = await getSessionContext();
  if (!user) {
    return { success: false, error: "Tu sesión venció. Ingresá de nuevo." };
  }

  // Crear otro club no está disponible por ahora.
  if (memberships.length > 0) {
    return { success: false, error: "Ya pertenecés a un club." };
  }

  const { data: clubId, error } = await supabase.rpc("create_club", {
    p_name: parsed.data.name,
    p_city: parsed.data.city,
    p_courts: parsed.data.courts,
  });

  if (error || !clubId) {
    return {
      success: false,
      error: error ? dbMessage(error, "No se pudo crear el club.") : "No se pudo crear el club.",
    };
  }

  await setActiveClubCookie(clubId as string);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/canchas?alta=1");
}
