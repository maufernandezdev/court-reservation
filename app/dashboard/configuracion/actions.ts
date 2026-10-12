"use server";

import { revalidatePath } from "next/cache";
import { clubSettingsSchema, type ClubSettings } from "@/lib/reservations";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function saveSettingsAction(
  input: Pick<ClubSettings, "cancel_window_hours" | "late_penalty_percent">
): Promise<{ success: boolean; error?: string }> {
  const parsed = clubSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { error } = await supabase.from("settings").upsert({
      club_id: clubId,
      cancel_window_hours: parsed.data.cancel_window_hours,
      late_penalty_percent: parsed.data.late_penalty_percent,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: "No se pudo guardar la configuración." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "settings",
      entityId: clubId,
      action: "settings.updated",
      payload: parsed.data,
    });

    revalidatePath("/dashboard/configuracion");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "No se pudo guardar la configuración.",
    };
  }
}
