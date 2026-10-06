"use server";

import { revalidatePath } from "next/cache";
import { courtSchema, type CourtInput } from "@/lib/courts";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function createCourtAction(
  input: CourtInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = courtSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");

    const ownerId = membership!.owner_id;

    const { data, error } = await supabase
      .from("courts")
      .insert({
        name: parsed.data.name.trim(),
        type: parsed.data.type,
        price_per_hour: parsed.data.price_per_hour,
        slot_duration: parsed.data.slot_duration,
        open_time: parsed.data.open_time,
        close_time: parsed.data.close_time,
        deposit_enabled: parsed.data.deposit_enabled,
        deposit_type: parsed.data.deposit_type,
        deposit_value: parsed.data.deposit_value,
        user_id: ownerId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo crear la cancha." };
    }

    await writeAudit(supabase, {
      ownerId,
      actorId: user!.id,
      entity: "court",
      entityId: data.id,
      action: "court.created",
      payload: { name: parsed.data.name.trim() },
    });

    revalidatePath("/dashboard/canchas");
    revalidatePath("/dashboard/reservas");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo crear la cancha.",
    };
  }
}

export async function updateCourtAction(
  id: string,
  input: CourtInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = courtSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");

    const ownerId = membership!.owner_id;

    const { error } = await supabase
      .from("courts")
      .update({
        name: parsed.data.name.trim(),
        type: parsed.data.type,
        price_per_hour: parsed.data.price_per_hour,
        slot_duration: parsed.data.slot_duration,
        open_time: parsed.data.open_time,
        close_time: parsed.data.close_time,
        deposit_enabled: parsed.data.deposit_enabled,
        deposit_type: parsed.data.deposit_type,
        deposit_value: parsed.data.deposit_value,
      })
      .eq("id", id)
      .eq("user_id", ownerId);

    if (error) {
      return { success: false, error: "No se pudo actualizar la cancha." };
    }

    await writeAudit(supabase, {
      ownerId,
      actorId: user!.id,
      entity: "court",
      entityId: id,
      action: "court.updated",
      payload: { name: parsed.data.name.trim() },
    });

    revalidatePath("/dashboard/canchas");
    revalidatePath("/dashboard/reservas");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "No se pudo actualizar la cancha.",
    };
  }
}

// Baja lógica: la cancha queda en la base (con sus reservas) pero no se muestra.
export async function deactivateCourtAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user, membership } = await requireRole("admin");

    const ownerId = membership!.owner_id;

    const { error } = await supabase
      .from("courts")
      .update({ active: false })
      .eq("id", id)
      .eq("user_id", ownerId);

    if (error) {
      return { success: false, error: "No se pudo eliminar la cancha." };
    }

    await writeAudit(supabase, {
      ownerId,
      actorId: user!.id,
      entity: "court",
      entityId: id,
      action: "court.deactivated",
    });

    revalidatePath("/dashboard/canchas");
    revalidatePath("/dashboard/reservas");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "No se pudo eliminar la cancha.",
    };
  }
}
