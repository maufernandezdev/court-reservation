"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clubTodayKey } from "@/lib/club-time";
import { subscriptionMessage } from "@/lib/subscription";
import {
  cashExpenseSchema,
  cashOpeningSchema,
  cashSaleSchema,
  type CashExpenseInput,
  type CashOpeningInput,
  type CashSaleInput,
} from "@/lib/cash";

type Result = { success: boolean; error?: string };

function fail(err: unknown, fallback: string): Result {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

function firstIssue(error: z.ZodError): Result {
  return { success: false, error: error.issues[0]?.message ?? "Datos inválidos." };
}

const FUTURE_MESSAGE = "No se pueden cargar movimientos de días que todavía no llegaron.";

/** Venta de accesorio u otro ingreso: la carga el admin o el operador. */
export async function registerCashSaleAction(input: CashSaleInput): Promise<Result> {
  const parsed = cashSaleSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  if (parsed.data.date > clubTodayKey()) return { success: false, error: FUTURE_MESSAGE };

  try {
    const { supabase, user, membership } = await requireRole("operador");
    const clubId = membership!.club_id;
    const { date, category, concept, unit_price, quantity, method } = parsed.data;
    const amount = Math.round(unit_price * quantity * 100) / 100;

    const { data, error } = await supabase
      .from("cash_movements")
      .insert({
        club_id: clubId,
        date,
        type: "in",
        category,
        concept,
        quantity,
        amount,
        method,
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo registrar la venta.") };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "cash_movement",
      entityId: data.id,
      action: "cash.movement_created",
      payload: { type: "in", category, concept, quantity, amount, method, date },
    });

    revalidatePath("/dashboard/caja");
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo registrar la venta.");
  }
}

/** Salida de plata: solo el admin. */
export async function registerCashExpenseAction(input: CashExpenseInput): Promise<Result> {
  const parsed = cashExpenseSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  if (parsed.data.date > clubTodayKey()) return { success: false, error: FUTURE_MESSAGE };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { date, category, counterparty, amount, method, note } = parsed.data;

    const { data, error } = await supabase
      .from("cash_movements")
      .insert({
        club_id: clubId,
        date,
        type: "out",
        category,
        counterparty,
        amount,
        method,
        note,
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo registrar la salida.") };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "cash_movement",
      entityId: data.id,
      action: "cash.movement_created",
      payload: { type: "out", category, counterparty, amount, method, note, date },
    });

    revalidatePath("/dashboard/caja");
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo registrar la salida.");
  }
}

/** Anula un movimiento manual (queda tachado; nunca se borra). Solo el admin. */
export async function voidCashMovementAction(movementId: string): Promise<Result> {
  const parsed = z.string().uuid().safeParse(movementId);
  if (!parsed.success) return { success: false, error: "Movimiento inválido." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    // voided_at y voided_by los completa el trigger de la base.
    const { data, error } = await supabase
      .from("cash_movements")
      .update({ voided: true, voided_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("club_id", clubId)
      .eq("voided", false)
      .select("id, type, category, concept, counterparty, amount, method, date")
      .maybeSingle();
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo anular el movimiento.") };
    if (!data) return { success: false, error: "El movimiento no existe o ya estaba anulado." };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "cash_movement",
      entityId: data.id,
      action: "cash.movement_voided",
      payload: data,
    });

    revalidatePath("/dashboard/caja");
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo anular el movimiento.");
  }
}

/** Cambio inicial de la caja del día. Solo el admin. */
export async function setCashOpeningAction(input: CashOpeningInput): Promise<Result> {
  const parsed = cashOpeningSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  if (parsed.data.date > clubTodayKey()) return { success: false, error: FUTURE_MESSAGE };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { error } = await supabase.from("cash_openings").upsert({
      club_id: clubId,
      date: parsed.data.date,
      amount: parsed.data.amount,
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    });
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo guardar el cambio.") };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "cash_opening",
      entityId: null,
      action: "cash.opening_set",
      payload: parsed.data,
    });

    revalidatePath("/dashboard/caja");
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo guardar el cambio.");
  }
}
