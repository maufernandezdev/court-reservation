"use server";

import { revalidatePath } from "next/cache";
import { courtSchema, type CourtInput } from "@/lib/courts";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  nightStartSchema,
  sportPricesSchema,
  type NightStartInput,
  type SportPricesInput,
} from "@/lib/pricing";
import { subscriptionMessage } from "@/lib/subscription";

/** Cada tipo de cancha del club tiene su fila de precios (empieza en $0 hasta que el admin la cargue). */
async function ensureSportPrices(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  clubId: string,
  sport: CourtInput["type"]
): Promise<void> {
  await supabase
    .from("sport_prices")
    .upsert({ club_id: clubId, sport }, { onConflict: "club_id,sport", ignoreDuplicates: true });
}

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

    const clubId = membership!.club_id;

    const { data, error } = await supabase
      .from("courts")
      .insert({
        name: parsed.data.name.trim(),
        type: parsed.data.type,
        club_id: clubId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo crear la cancha.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "court",
      entityId: data.id,
      action: "court.created",
      payload: { name: parsed.data.name.trim() },
    });

    await ensureSportPrices(supabase, clubId, parsed.data.type);

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

    const clubId = membership!.club_id;

    const { error } = await supabase
      .from("courts")
      .update({
        name: parsed.data.name.trim(),
        type: parsed.data.type,
      })
      .eq("id", id)
      .eq("club_id", clubId);

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo actualizar la cancha.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "court",
      entityId: id,
      action: "court.updated",
      payload: { name: parsed.data.name.trim() },
    });

    await ensureSportPrices(supabase, clubId, parsed.data.type);

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

    const clubId = membership!.club_id;

    const { error } = await supabase
      .from("courts")
      .update({ active: false })
      .eq("id", id)
      .eq("club_id", clubId);

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo eliminar la cancha.") };
    }

    await writeAudit(supabase, {
      clubId,
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

/** Precios de día y de noche (público y profe) y señas (público y profes) de un tipo de cancha (solo admin). */
export async function updateSportPricesAction(
  input: SportPricesInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = sportPricesSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { sport, ...values } = parsed.data;

    const { error } = await supabase.from("sport_prices").upsert(
      { club_id: clubId, sport, ...values, updated_at: new Date().toISOString() },
      { onConflict: "club_id,sport" }
    );

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudieron guardar los precios.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "prices",
      entityId: null,
      action: "prices.updated",
      payload: parsed.data,
    });

    revalidatePath("/dashboard/canchas");
    revalidatePath("/dashboard/reservas");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudieron guardar los precios.",
    };
  }
}

/** Hora desde la que rige el precio de noche en todo el club (solo admin). */
export async function updateNightStartAction(
  input: NightStartInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = nightStartSchema.safeParse(input);

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
        night_starts_at: parsed.data.night_starts_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id" }
    );

    if (error) {
      return { success: false, error: subscriptionMessage(error, "No se pudo guardar el horario de noche.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "prices",
      entityId: null,
      action: "prices.updated",
      payload: parsed.data,
    });

    revalidatePath("/dashboard/canchas");
    revalidatePath("/dashboard/reservas");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el horario de noche.",
    };
  }
}
