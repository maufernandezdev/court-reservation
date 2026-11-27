"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { subscriptionMessage } from "@/lib/subscription";
import {
  settleAmountSchema,
  settlePendingSchema,
  type SettleAmountInput,
  type SettlePendingInput,
} from "@/lib/profe-settlement";

type Result = { success: boolean; error?: string; count?: number; amount?: number; remaining?: number };

function revalidateMoney() {
  revalidatePath("/dashboard/liquidaciones");
  revalidatePath("/dashboard/caja");
  revalidatePath("/dashboard/reservas");
  revalidatePath("/dashboard/reportes");
  revalidatePath("/dashboard/mis-turnos");
}

function dbMessage(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "42501" || error.code === "22023" ? error.message : subscriptionMessage(error, fallback);
}

async function profeName(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  clubId: string,
  profeUserId: string
): Promise<string> {
  const { data } = await supabase
    .from("memberships")
    .select("full_name, email")
    .eq("club_id", clubId)
    .eq("user_id", profeUserId)
    .maybeSingle();
  return data?.full_name || data?.email || "";
}

/**
 * El profe paga todo lo que tiene pendiente hasta una fecha (desde "Liquidar desde"): se cobra el saldo
 * de cada turno ya jugado, quedan pagados y la liquidación queda en el historial. Solo el admin.
 */
export async function settlePendingAction(input: SettlePendingInput): Promise<Result> {
  const parsed = settlePendingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { profeUserId, until, method } = parsed.data;

    const { data, error } = await supabase.rpc("settle_profe_pending", {
      p_club_id: clubId,
      p_profe_user_id: profeUserId,
      p_until: until,
      p_method: method,
    });
    if (error) return { success: false, error: dbMessage(error, "No se pudo registrar la liquidación.") };

    const row = (Array.isArray(data) ? data[0] : data) as
      | { settlement_id: string; settled_count: number; settled_amount: number }
      | null;
    const count = Number(row?.settled_count ?? 0);
    const amount = Number(row?.settled_amount ?? 0);

    const { data: settingsRow } = await supabase.from("settings").select("settle_from").eq("club_id", clubId).maybeSingle();

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "profe_settlement",
      entityId: row?.settlement_id ?? profeUserId,
      action: "profe.settled",
      payload: {
        profe: await profeName(supabase, clubId, profeUserId),
        from: settingsRow?.settle_from ?? null,
        to: until,
        method,
        count,
        amount,
      },
    });

    revalidateMoney();
    return { success: true, count, amount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo registrar la liquidación." };
  }
}

/**
 * Cobro a cuenta del profe: el total que debe o un monto menor. Se imputa a los turnos jugados más viejos
 * primero (el último puede quedar con un pago parcial) y entra a la caja de hoy. Solo el admin.
 */
export async function settleAmountAction(input: SettleAmountInput): Promise<Result> {
  const parsed = settleAmountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { profeUserId, amount, method } = parsed.data;

    const { data, error } = await supabase.rpc("settle_profe_amount", {
      p_club_id: clubId,
      p_profe_user_id: profeUserId,
      p_amount: amount,
      p_method: method,
    });
    if (error) return { success: false, error: dbMessage(error, "No se pudo registrar el cobro.") };

    const row = (Array.isArray(data) ? data[0] : data) as
      | { settlement_id: string; settled_count: number; settled_amount: number; remaining: number }
      | null;
    const count = Number(row?.settled_count ?? 0);
    const settled = Number(row?.settled_amount ?? 0);
    const remaining = Number(row?.remaining ?? 0);

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "profe_settlement",
      entityId: row?.settlement_id ?? profeUserId,
      action: "profe.settled",
      payload: {
        profe: await profeName(supabase, clubId, profeUserId),
        method,
        count,
        amount: settled,
        partial: amount !== null,
        remaining,
      },
    });

    revalidateMoney();
    return { success: true, count, amount: settled, remaining };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo registrar el cobro." };
  }
}

/** Deshace una liquidación: borra sus cobros y los turnos vuelven a pendiente. Solo el admin. */
export async function voidSettlementAction(settlementId: string): Promise<Result> {
  const parsedId = z.string().uuid("Liquidación inválida.").safeParse(settlementId);
  if (!parsedId.success) return { success: false, error: "Liquidación inválida." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { data: settlement } = await supabase
      .from("profe_settlements")
      .select("profe_user_id")
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .maybeSingle();
    if (!settlement) return { success: false, error: "No se encontró la liquidación." };

    const { data, error } = await supabase.rpc("void_profe_settlement", { p_settlement_id: parsedId.data });
    if (error) return { success: false, error: dbMessage(error, "No se pudo deshacer la liquidación.") };

    const row = (Array.isArray(data) ? data[0] : data) as { reverted_count: number; reverted_amount: number } | null;
    const count = Number(row?.reverted_count ?? 0);
    const amount = Number(row?.reverted_amount ?? 0);

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "profe_settlement",
      entityId: parsedId.data,
      action: "profe.settlement_voided",
      payload: { profe: await profeName(supabase, clubId, settlement.profe_user_id), count, amount },
    });

    revalidateMoney();
    return { success: true, count, amount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo deshacer la liquidación." };
  }
}
