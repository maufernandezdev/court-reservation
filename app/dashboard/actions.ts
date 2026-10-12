"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionContext, setActiveClubCookie } from "@/lib/auth";

/** Cambia el club activo (solo a un club del que la persona es miembro). */
export async function switchClubAction(
  clubId: string
): Promise<{ success: boolean; error?: string }> {
  const parsed = z.string().uuid("Club inválido.").safeParse(clubId);
  if (!parsed.success) {
    return { success: false, error: "Club inválido." };
  }

  const { user, memberships } = await getSessionContext();
  if (!user) {
    return { success: false, error: "No hay sesión activa." };
  }

  if (!memberships.some((m) => m.club_id === parsed.data)) {
    return { success: false, error: "No sos miembro de ese club." };
  }

  await setActiveClubCookie(parsed.data);
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
