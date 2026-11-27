"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { subscriptionMessage } from "@/lib/subscription";
import { specialDaySchema, type SpecialDayAffected, type SpecialDayInput } from "@/lib/special-days";

type ApplyResult = {
  success: boolean;
  error?: string;
  cancelled?: number;
  repriced?: number;
  people?: SpecialDayAffected[];
};

function dbMessage(error: { code?: string; message: string }, fallback: string): string {
  return ["42501", "22023", "P0001"].includes(error.code ?? "") ? error.message : subscriptionMessage(error, fallback);
}

function revalidateDay() {
  revalidatePath("/dashboard/reservas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/caja");
}

/** Marca un día especial (feriado) y, si se pide, cancela sus turnos en término. Solo admin. */
export async function applySpecialDayAction(input: SpecialDayInput): Promise<ApplyResult> {
  const parsed = specialDaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const { supabase, membership } = await requireRole("admin");
    const { data, error } = await supabase.rpc("apply_special_day", {
      p_club_id: membership!.club_id,
      p_date: parsed.data.date,
      p_label: parsed.data.label,
      p_closed: parsed.data.closed,
      p_hourly_price: parsed.data.hourlyPrice === "" ? null : Number(parsed.data.hourlyPrice),
      p_cancel: parsed.data.cancel,
    });
    if (error) return { success: false, error: dbMessage(error, "No se pudo guardar el feriado.") };

    revalidateDay();
    const result = data as { cancelled: number; repriced: number; people: SpecialDayAffected[] };
    return {
      success: true,
      cancelled: result.cancelled,
      repriced: result.repriced,
      people: (result.people ?? []).map((p) => ({ ...p, released: Number(p.released) })),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo guardar el feriado." };
  }
}

const removeSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida") });

/** Quita el día especial. Los turnos que se cancelaron no vuelven. */
export async function removeSpecialDayAction(date: string): Promise<{ success: boolean; error?: string }> {
  const parsed = removeSchema.safeParse({ date });
  if (!parsed.success) return { success: false, error: "Fecha inválida." };
  try {
    const { supabase, membership } = await requireRole("admin");
    const { error } = await supabase.rpc("remove_special_day", {
      p_club_id: membership!.club_id,
      p_date: parsed.data.date,
    });
    if (error) return { success: false, error: dbMessage(error, "No se pudo quitar el feriado.") };
    revalidateDay();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo quitar el feriado." };
  }
}
