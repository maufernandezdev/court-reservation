"use server";

import { revalidatePath } from "next/cache";
import { clubSettingsSchema, type ClubSettings } from "@/lib/reservations";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clubDetailsSchema, clubHoursSchema, type ClubDetailsInput, type ClubHoursInput } from "@/lib/clubs";
import { subscriptionMessage } from "@/lib/subscription";
import { deleteObject, isR2Configured, putObject } from "@/lib/r2";

export async function saveSettingsAction(
  input: Pick<
    ClubSettings,
    "cancel_window_hours" | "late_penalty_percent" | "tournament_duration_minutes"
  >
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
      tournament_duration_minutes: parsed.data.tournament_duration_minutes,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo guardar la configuración.") };
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

/** Nombre y ciudad del club activo (solo admin). */
export async function updateClubDetailsAction(
  input: ClubDetailsInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = clubDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { data, error } = await supabase
      .from("clubs")
      .update({ name: parsed.data.name, city: parsed.data.city })
      .eq("id", clubId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: subscriptionMessage(error, "No se pudieron guardar los datos del club.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "club",
      entityId: clubId,
      action: "club.updated",
      payload: parsed.data,
    });

    // El nombre se muestra en el menú de todo el panel.
    revalidatePath("/dashboard", "layout");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "No se pudieron guardar los datos del club.",
    };
  }
}

/** Horario de apertura y cierre del club activo (solo admin). Vale para todas las canchas. */
export async function updateClubHoursAction(
  input: ClubHoursInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = clubHoursSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { error } = await supabase.from("settings").upsert(
      {
        club_id: clubId,
        open_time: parsed.data.open_time,
        close_time: parsed.data.close_time,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id" }
    );

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo guardar el horario del club.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "club",
      entityId: clubId,
      action: "club.updated",
      payload: parsed.data,
    });

    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/canchas");
    revalidatePath("/dashboard/reservas");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el horario del club.",
    };
  }
}

const MAX_LOGO_BYTES = 1024 * 1024;

/**
 * Logo del club: llega ya ajustado (WebP 512×512) desde el navegador, se sube a R2 en
 * `logos/<clubId>.webp` y se guarda la ruta en el club (solo admin).
 */
export async function uploadClubLogoAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Elegí una imagen." };
  }
  if (file.type !== "image/webp" || file.size > MAX_LOGO_BYTES) {
    return { success: false, error: "La imagen no es válida. Probá con otra (JPG, PNG o WebP de hasta 5 MB)." };
  }
  if (!isR2Configured()) {
    return { success: false, error: "Las imágenes todavía no están configuradas en el servidor." };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const path = `logos/${clubId}.webp`;

    try {
      await putObject(path, await file.arrayBuffer(), "image/webp");
    } catch {
      return { success: false, error: "No se pudo subir el logo. Probá de nuevo." };
    }

    const { data, error } = await supabase
      .from("clubs")
      .update({ logo_path: path, logo_updated_at: new Date().toISOString() })
      .eq("id", clubId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: subscriptionMessage(error, "No se pudo guardar el logo.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "club",
      entityId: clubId,
      action: "club.updated",
      payload: { logo: "updated" },
    });

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo guardar el logo." };
  }
}

/** Quita el logo: se borra de R2 y el menú vuelve a mostrar las iniciales (solo admin). */
export async function removeClubLogoAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { data, error } = await supabase
      .from("clubs")
      .update({ logo_path: null, logo_updated_at: null })
      .eq("id", clubId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: subscriptionMessage(error, "No se pudo quitar el logo.") };
    }
    if (isR2Configured()) {
      await deleteObject(`logos/${clubId}.webp`).catch(() => {});
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "club",
      entityId: clubId,
      action: "club.updated",
      payload: { logo: "removed" },
    });

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo quitar el logo." };
  }
}
