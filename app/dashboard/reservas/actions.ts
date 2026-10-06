"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cancelReservationSchema,
  registerPaymentSchema,
  reservationInputSchema,
  type Payment,
  type Reservation,
  type ReservationInput,
} from "@/lib/reservations";
import type { Court } from "@/lib/courts";
import { getDepositAmount, getSlotPrice } from "@/lib/pricing";
import { getCourtSlots, rangesOverlap, timeToMinutes } from "@/lib/availability";
import { requireRole, type SessionContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const DOUBLE_BOOKING_MESSAGE = "Esa cancha ya está reservada en ese horario";

/** El club opera en Argentina (UTC-3, sin horario de verano desde 2009). */
const CLUB_TIMEZONE_OFFSET = "-03:00";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type ActionResult = {
  success: boolean;
  error?: string;
  reservation?: Reservation;
};

function failure(error: unknown, fallback: string): ActionResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

async function fetchCourt(
  supabase: SupabaseClient,
  courtId: string
): Promise<Court | null> {
  const { data } = await supabase
    .from("courts")
    .select("*")
    .eq("id", courtId)
    .maybeSingle();
  return (data as Court | null) ?? null;
}

async function fetchReservation(
  supabase: SupabaseClient,
  id: string
): Promise<Reservation | null> {
  const { data } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Reservation | null) ?? null;
}

/** Rechaza si ya existe una reserva activa que se solape con el turno. */
async function assertNoOverlap(
  supabase: SupabaseClient,
  courtId: string,
  date: string,
  time: string,
  durationMinutes: number,
  excludeId?: string
): Promise<void> {
  const { data } = await supabase
    .from("reservations")
    .select("id, time, duration_minutes")
    .eq("court_id", courtId)
    .eq("date", date)
    .eq("status", "active");

  const start = timeToMinutes(time);
  const overlaps = (data ?? []).some(
    (r) =>
      r.id !== excludeId &&
      rangesOverlap(
        start,
        durationMinutes,
        timeToMinutes(r.time as string),
        (r.duration_minutes as number) ?? 60
      )
  );

  if (overlaps) {
    throw new Error(DOUBLE_BOOKING_MESSAGE);
  }
}

async function fetchPayments(
  supabase: SupabaseClient,
  reservationId: string
): Promise<Payment[]> {
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Payment[];
}

function paidAmount(payments: Payment[]): number {
  return payments
    .filter((p) => !p.released)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

/** Ajusta el saldo a favor de un cliente vía RPC atómica (delta +/-). */
async function adjustCredit(
  supabase: SupabaseClient,
  ownerId: string,
  phone: string,
  delta: number
): Promise<void> {
  const { error } = await supabase.rpc("adjust_credit_balance", {
    p_owner_id: ownerId,
    p_phone: phone.trim(),
    p_delta: delta,
  });

  if (error) {
    throw new Error("No se pudo actualizar el saldo a favor del cliente.");
  }
}

export async function createReservationAction(
  input: ReservationInput
): Promise<ActionResult> {
  const parsed = reservationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const ctx: SessionContext = await requireRole("profesor");
    const { supabase, user } = ctx;

    const court = await fetchCourt(supabase, parsed.data.court_id);
    if (!court || !court.active) {
      return { success: false, error: "La cancha seleccionada no está disponible." };
    }

    // La franja debe ser un inicio válido de turno para esa cancha.
    if (!getCourtSlots(court).includes(parsed.data.time)) {
      return {
        success: false,
        error: "El horario no corresponde a una franja válida de la cancha.",
      };
    }

    await assertNoOverlap(
      supabase,
      court.id,
      parsed.data.date,
      parsed.data.time,
      court.slot_duration
    );

    const ownerId = court.user_id;

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        user_id: ownerId,
        court_id: court.id,
        date: parsed.data.date,
        time: parsed.data.time,
        duration_minutes: court.slot_duration,
        customer_name: parsed.data.customer_name.trim(),
        phone: parsed.data.phone.trim(),
        created_by: user!.id,
        updated_by: user!.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: DOUBLE_BOOKING_MESSAGE };
      }
      return { success: false, error: "No se pudo guardar la reserva." };
    }

    await writeAudit(supabase, {
      ownerId,
      actorId: user!.id,
      entity: "reservation",
      entityId: data.id,
      action: "reservation.created",
      payload: {
        customer_name: parsed.data.customer_name.trim(),
        court_id: court.id,
        date: parsed.data.date,
        time: parsed.data.time,
      },
    });

    revalidatePath("/dashboard/reservas");

    return { success: true, reservation: data as Reservation };
  } catch (err) {
    return failure(err, "No se pudo guardar la reserva.");
  }
}

export async function updateReservationAction(
  id: string,
  input: ReservationInput
): Promise<ActionResult> {
  const parsed = reservationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const ctx: SessionContext = await requireRole("profesor");
    const { supabase, user } = ctx;

    const existing = await fetchReservation(supabase, id);
    if (!existing) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (existing.status === "cancelled") {
      return {
        success: false,
        error: "La reserva ya fue cancelada y no se puede modificar.",
      };
    }

    const court = await fetchCourt(supabase, parsed.data.court_id);
    if (!court) {
      return { success: false, error: "La cancha seleccionada no existe." };
    }

    // La franja debe ser un inicio válido de turno para esa cancha.
    if (!getCourtSlots(court).includes(parsed.data.time)) {
      return {
        success: false,
        error: "El horario no corresponde a una franja válida de la cancha.",
      };
    }

    await assertNoOverlap(
      supabase,
      court.id,
      parsed.data.date,
      parsed.data.time,
      existing.duration_minutes,
      id
    );

    const { data, error } = await supabase
      .from("reservations")
      .update({
        court_id: court.id,
        date: parsed.data.date,
        time: parsed.data.time,
        customer_name: parsed.data.customer_name.trim(),
        phone: parsed.data.phone.trim(),
        updated_by: user!.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: DOUBLE_BOOKING_MESSAGE };
      }
      return { success: false, error: "No se pudo actualizar la reserva." };
    }

    await writeAudit(supabase, {
      ownerId: existing.user_id,
      actorId: user!.id,
      entity: "reservation",
      entityId: id,
      action: "reservation.updated",
      payload: {
        customer_name: parsed.data.customer_name.trim(),
        date: parsed.data.date,
        time: parsed.data.time,
      },
    });

    revalidatePath("/dashboard/reservas");

    return { success: true, reservation: data as Reservation };
  } catch (err) {
    return failure(err, "No se pudo actualizar la reserva.");
  }
}

export async function cancelReservationAction(
  id: string,
  reason: string
): Promise<ActionResult> {
  const parsed = cancelReservationSchema.safeParse({ reason });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const ctx: SessionContext = await requireRole("profesor");
    const { supabase, user, membership } = ctx;

    const reservation = await fetchReservation(supabase, id);
    if (!reservation) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (reservation.status === "cancelled") {
      return { success: false, error: "La reserva ya estaba cancelada." };
    }

    const court = await fetchCourt(supabase, reservation.court_id);
    const slotPrice = court
      ? getSlotPrice(court, reservation.duration_minutes)
      : 0;

    // Política del club (defaults si no configuró).
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("cancel_window_hours, late_penalty_percent")
      .eq("owner_id", reservation.user_id)
      .maybeSingle();

    const cancelWindowHours = settingsRow?.cancel_window_hours ?? 24;
    const latePenaltyPercent = settingsRow?.late_penalty_percent ?? 50;

    const startsAt = new Date(
      `${reservation.date}T${reservation.time}:00${CLUB_TIMEZONE_OFFSET}`
    );
    const hoursUntilStart =
      (startsAt.getTime() - Date.now()) / 3_600_000;
    const isLate = hoursUntilStart < cancelWindowHours;

    // Los profesores no pueden cancelar dentro de la ventana de penalidad.
    if (isLate && membership!.role === "profesor") {
      return {
        success: false,
        error:
          "Esta cancelación entra en la ventana de penalidad. Consultá con un administrador para gestionarla.",
      };
    }

    // Cobros previos ANTES de mutar nada: los profesores no pueden cancelar
    // reservas con cobros registrados (la plata la gestiona el personal).
    const payments = await fetchPayments(supabase, id);
    const pendingPayments = payments.filter((p) => !p.released);
    const paidTotal = round2(
      pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    );

    if (paidTotal > 0 && membership!.role === "profesor") {
      return {
        success: false,
        error:
          "Esta reserva tiene cobros registrados. Consultá con un administrador para cancelarla y gestionar la devolución.",
      };
    }

    // 1) Marcar la reserva cancelada: si algo posterior falla,
    //    nunca queda plata movida con el turno todavía activo.
    const { data, error } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user!.id,
        cancel_reason: parsed.data.reason.trim() || null,
        late_cancel: isLate,
        updated_by: user!.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo cancelar la reserva." };
    }

    // 2) Política de cobros: se considera todo lo cobrado (seña, total o saldo).
    let retained = 0;
    let releasedAmount = 0;
    let debt = 0;
    let penalty = 0;

    if (isLate) {
      penalty = round2(slotPrice * (latePenaltyPercent / 100));
      retained = Math.min(paidTotal, penalty);
      releasedAmount = round2(paidTotal - retained);
      debt = round2(Math.max(0, penalty - paidTotal));
    } else {
      releasedAmount = paidTotal;
    }

    // Liberar cobros completos mientras alcance el monto liberado; lo retenido
    // queda sin liberar (es la penalidad). En cancelación en término se libera todo.
    // Se acredita exactamente lo liberado (releaseBudget puede quedar corto si un
    // cobro individual supera lo liberable: ese excedente queda retenido).
    let releaseBudget = releasedAmount;
    let releasedActual = 0;
    for (const payment of pendingPayments) {
      if (releaseBudget <= 0) break;
      const amount = Number(payment.amount);
      if (amount > 0 && amount <= releaseBudget) {
        const { error: releaseError } = await supabase
          .from("payments")
          .update({ released: true })
          .eq("id", payment.id);
        if (releaseError) {
          throw new Error("No se pudo liberar los cobros de la reserva.");
        }
        releaseBudget = round2(releaseBudget - amount);
        releasedActual = round2(releasedActual + amount);
      }
    }

    // Saldo a favor: lo efectivamente liberado suma, la deuda resta.
    const phone = reservation.phone.trim();
    if (phone) {
      const delta = round2(releasedActual - debt);
      if (delta !== 0) {
        await adjustCredit(supabase, reservation.user_id, phone, delta);
      }
    }

    await writeAudit(supabase, {
      ownerId: reservation.user_id,
      actorId: user!.id,
      entity: "reservation",
      entityId: id,
      action: "reservation.cancelled",
      payload: {
        late: isLate,
        penalty: isLate ? penalty : undefined,
        retained: retained > 0 ? retained : undefined,
        released: releasedActual > 0 ? releasedActual : undefined,
        debt: debt > 0 ? debt : undefined,
        reason: parsed.data.reason.trim() || undefined,
      },
    });

    revalidatePath("/dashboard/reservas");

    return { success: true, reservation: data as Reservation };
  } catch (err) {
    return failure(err, "No se pudo cancelar la reserva.");
  }
}

export async function registerPaymentAction(
  reservationId: string,
  input: { kind: string; method: string }
): Promise<ActionResult> {
  const parsed = registerPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  if (parsed.data.kind === "saldo") {
    return {
      success: false,
      error: "El saldo a favor se aplica con la acción correspondiente.",
    };
  }

  try {
    const ctx: SessionContext = await requireRole("operador");
    const { supabase, user } = ctx;

    const reservation = await fetchReservation(supabase, reservationId);
    if (!reservation) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (reservation.status === "cancelled") {
      return {
        success: false,
        error: "La reserva está cancelada y no admite cobros.",
      };
    }

    const court = await fetchCourt(supabase, reservation.court_id);
    if (!court) {
      return { success: false, error: "No se encontró la cancha." };
    }

    // Idempotencia: revalidar el estado real antes de registrar el cobro.
    const existingPayments = await fetchPayments(supabase, reservationId);
    if (
      parsed.data.kind === "seña" &&
      existingPayments.some((p) => p.kind === "seña" && !p.released)
    ) {
      return { success: false, error: "La seña de esta reserva ya fue cobrada." };
    }
    if (
      parsed.data.kind === "total" &&
      reservation.payment_status === "pagada"
    ) {
      return { success: false, error: "Esta reserva ya está totalmente paga." };
    }

    // "total" cobra solo el saldo: precio del turno menos lo ya cobrado
    // (seña, pagos previos o saldo a favor aplicado, sin contar lo liberado).
    const amount =
      parsed.data.kind === "seña"
        ? getDepositAmount(court, reservation.duration_minutes)
        : Math.max(
            0,
            getSlotPrice(court, reservation.duration_minutes) -
              paidAmount(existingPayments)
          );

    if (parsed.data.kind === "seña" && amount <= 0) {
      return {
        success: false,
        error: "Esta cancha no tiene seña configurada.",
      };
    }

    // Si ya estaba todo cobrado (ej. saldo a favor que cubrió el turno), solo se marca como pagada.
    if (amount > 0) {
      const { error: paymentError } = await supabase.from("payments").insert({
        owner_id: reservation.user_id,
        reservation_id: reservationId,
        kind: parsed.data.kind,
        amount,
        method: parsed.data.method,
        created_by: user!.id,
      });

      if (paymentError) {
        return { success: false, error: "No se pudo registrar el cobro." };
      }
    }

    const nextStatus = parsed.data.kind === "seña" ? "senada" : "pagada";

    const { data, error } = await supabase
      .from("reservations")
      .update({ payment_status: nextStatus, updated_by: user!.id })
      .eq("id", reservationId)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo actualizar la reserva." };
    }

    await writeAudit(supabase, {
      ownerId: reservation.user_id,
      actorId: user!.id,
      entity: "reservation",
      entityId: reservationId,
      action: "payment.registered",
      payload: { kind: parsed.data.kind, amount, method: parsed.data.method },
    });

    revalidatePath("/dashboard/reservas");

    return { success: true, reservation: data as Reservation };
  } catch (err) {
    return failure(err, "No se pudo registrar el cobro.");
  }
}

export async function applyCreditAction(
  reservationId: string
): Promise<ActionResult> {
  try {
    const ctx: SessionContext = await requireRole("operador");
    const { supabase, user } = ctx;

    const reservation = await fetchReservation(supabase, reservationId);
    if (!reservation) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (reservation.status === "cancelled") {
      return {
        success: false,
        error: "La reserva está cancelada y no admite cobros.",
      };
    }

    const phone = reservation.phone.trim();
    if (!phone) {
      return {
        success: false,
        error: "La reserva no tiene teléfono asociado para buscar saldo a favor.",
      };
    }

    const court = await fetchCourt(supabase, reservation.court_id);
    if (!court) {
      return { success: false, error: "No se encontró la cancha." };
    }

    const { data: creditRow } = await supabase
      .from("credit_balances")
      .select("amount")
      .eq("owner_id", reservation.user_id)
      .eq("customer_phone", phone)
      .maybeSingle();

    const credit = Number(creditRow?.amount ?? 0);
    if (credit <= 0) {
      return {
        success: false,
        error: "El cliente no tiene saldo a favor disponible.",
      };
    }

    const payments = await fetchPayments(supabase, reservationId);
    const paid = paidAmount(payments);
    const slotPrice = getSlotPrice(court, reservation.duration_minutes);
    const remaining = Math.max(0, slotPrice - paid);

    if (remaining <= 0) {
      return {
        success: false,
        error: "El turno ya está totalmente pago.",
      };
    }

    const applied = Math.min(credit, remaining);

    await adjustCredit(supabase, reservation.user_id, phone, -applied);

    const { error: paymentError } = await supabase.from("payments").insert({
      owner_id: reservation.user_id,
      reservation_id: reservationId,
      kind: "saldo",
      amount: applied,
      method: "otro",
      created_by: user!.id,
    });

    if (paymentError) {
      // Compensar el descuento del saldo si el registro del pago falló.
      await supabase.rpc("adjust_credit_balance", {
        p_owner_id: reservation.user_id,
        p_phone: phone,
        p_delta: applied,
      });
      return { success: false, error: "No se pudo aplicar el saldo." };
    }

    const totalPaid = paid + applied;
    const nextStatus: Reservation["payment_status"] =
      totalPaid >= slotPrice ? "pagada" : totalPaid > 0 ? "senada" : "pendiente";

    const { data, error } = await supabase
      .from("reservations")
      .update({ payment_status: nextStatus, updated_by: user!.id })
      .eq("id", reservationId)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo actualizar la reserva." };
    }

    await writeAudit(supabase, {
      ownerId: reservation.user_id,
      actorId: user!.id,
      entity: "reservation",
      entityId: reservationId,
      action: "credit.applied",
      payload: { amount: applied },
    });

    revalidatePath("/dashboard/reservas");

    return { success: true, reservation: data as Reservation };
  } catch (err) {
    return failure(err, "No se pudo aplicar el saldo.");
  }
}
