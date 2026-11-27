"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { approvalRuleSchema, type ApprovalRuleInput } from "@/lib/approval";
import { clubSettingsSchema, type ClubSettings } from "@/lib/reservations";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  clubDetailsSchema,
  clubHoursSchema,
  clubSocialSchema,
  type ClubDetailsInput,
  type ClubHoursInput,
  type ClubSocialInput,
} from "@/lib/clubs";
import { subscriptionMessage } from "@/lib/subscription";
import { deleteObject, isR2Configured, putObject } from "@/lib/r2";

export async function saveSettingsAction(
  input: Pick<
    ClubSettings,
    "cancel_window_hours" | "late_penalty_percent" | "series_cancel_limit" | "tournament_duration_minutes"
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
      series_cancel_limit: parsed.data.series_cancel_limit,
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

/** Nueva franja con confirmación del admin (solo admin). */
export async function createApprovalRuleAction(
  input: ApprovalRuleInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = approvalRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const data = parsed.data;

    if (data.court_id) {
      const { data: court } = await supabase
        .from("courts")
        .select("id")
        .eq("club_id", clubId)
        .eq("id", data.court_id)
        .maybeSingle();
      if (!court) return { success: false, error: "Elegí una cancha del club." };
    }

    const row = {
      club_id: clubId,
      court_id: data.court_id,
      weekdays: data.mode === "weekdays" ? [...new Set(data.weekdays)].sort() : null,
      on_date: data.mode === "date" ? data.on_date : null,
      from_time: data.from_time,
      to_time: data.to_time === "24:00" ? "24:00:00" : data.to_time,
      created_by: user!.id,
    };
    const { data: created, error } = await supabase.from("approval_rules").insert(row).select("id").single();
    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo guardar el horario.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "approval_rule",
      entityId: created.id,
      action: "approval_rule.created",
      payload: row,
    });

    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/reservas");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo guardar el horario." };
  }
}

/** Quita una franja con confirmación (solo admin). Los turnos ya pedidos siguen por confirmar. */
export async function deleteApprovalRuleAction(id: string): Promise<{ success: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Horario inválido." };
  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { data, error } = await supabase
      .from("approval_rules")
      .delete()
      .eq("club_id", clubId)
      .eq("id", id)
      .select("court_id, weekdays, on_date, from_time, to_time")
      .maybeSingle();
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo quitar el horario.") };
    if (!data) return { success: false, error: "El horario ya no existe." };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "approval_rule",
      entityId: id,
      action: "approval_rule.removed",
      payload: data,
    });
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/reservas");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo quitar el horario." };
  }
}

/** WhatsApp e Instagram del club (solo admin). */
export async function updateClubSocialAction(
  input: ClubSocialInput
): Promise<{ success: boolean; error?: string; values?: { whatsapp: string; instagram: string } }> {
  const parsed = clubSocialSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { error } = await supabase.from("settings").upsert({
      club_id: clubId,
      whatsapp: parsed.data.whatsapp,
      instagram: parsed.data.instagram,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudieron guardar las redes del club.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "club",
      entityId: clubId,
      action: "club.updated",
      payload: { social: true, whatsapp: parsed.data.whatsapp, instagram: parsed.data.instagram },
    });

    revalidatePath("/dashboard", "layout");
    return { success: true, values: parsed.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudieron guardar las redes del club." };
  }
}
