"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { subscriptionMessage } from "@/lib/subscription";
import { settleProfeSchema, type SettleProfeInput } from "@/lib/profe-settlement";

type Result = { success: boolean; error?: string; count?: number; amount?: number };

/** El profe paga sus turnos del período: se cobra el saldo de cada uno y quedan pagados. Solo el admin. */
export async function settleProfeAction(input: SettleProfeInput): Promise<Result> {
  const parsed = settleProfeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { profeUserId, from, to, method } = parsed.data;

    const { data, error } = await supabase.rpc("settle_profe_reservations", {
      p_club_id: clubId,
      p_profe_user_id: profeUserId,
      p_from: from,
      p_to: to,
      p_method: method,
    });
    if (error) {
      return {
        success: false,
        error: error.code === "42501" || error.code === "22023" ? error.message : subscriptionMessage(error, "No se pudo registrar la liquidación."),
      };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { settled_count: number; settled_amount: number } | null;
    const count = Number(row?.settled_count ?? 0);
    const amount = Number(row?.settled_amount ?? 0);

    const { data: profe } = await supabase
      .from("memberships")
      .select("full_name, email")
      .eq("club_id", clubId)
      .eq("user_id", profeUserId)
      .maybeSingle();

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "profe_settlement",
      entityId: profeUserId,
      action: "profe.settled",
      payload: { profe: profe?.full_name || profe?.email || "", from, to, method, count, amount },
    });

    revalidatePath("/dashboard/liquidaciones");
    revalidatePath("/dashboard/caja");
    revalidatePath("/dashboard/reservas");
    return { success: true, count, amount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo registrar la liquidación." };
  }
}
