"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cancelReservationSchema,
  registerPaymentSchema,
  reservationInputSchema,
  type Payment,
  MAX_PEOPLE,
  RESERVATION_SELECT,
  type Reservation,
  type ReservationInput,
} from "@/lib/reservations";
import type { Court } from "@/lib/courts";
import { depositFor, quotePrice, type SportPrices } from "@/lib/pricing";
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
  /** Turno fijo: fechas que se saltearon porque la cancha ya estaba ocupada. */
  skippedDates?: string[];
};

/** Semanas que se reservan al crear un turno fijo (las siguientes se generan al consultar). */
const SERIES_INITIAL_WEEKS = 8;

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function failure(error: unknown, fallback: string): ActionResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

async function fetchCourt(
  supabase: SupabaseClient,
  clubId: string,
  courtId: string
): Promise<Court | null> {
  const { data } = await supabase
    .from("courts")
    .select("*")
    .eq("id", courtId)
    .eq("club_id", clubId)
    .maybeSingle();
  return (data as Court | null) ?? null;
}

/** Precios del tipo de cancha (público, profe y seña). */
async function fetchSportPrices(
  supabase: SupabaseClient,
  clubId: string,
  sport: Court["type"]
): Promise<SportPrices | undefined> {
  const { data } = await supabase
    .from("sport_prices")
    .select("*")
    .eq("club_id", clubId)
    .eq("sport", sport)
    .maybeSingle();
  return (data as SportPrices | null) ?? undefined;
}

async function fetchReservation(
  supabase: SupabaseClient,
  clubId: string,
  id: string
): Promise<Reservation | null> {
  const { data } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("id", id)
    .eq("club_id", clubId)
    .maybeSingle();
  return (data as Reservation | null) ?? null;
}

/** Rechaza si ya existe una reserva activa que se solape con el turno. */
async function assertNoOverlap(
  supabase: SupabaseClient,
  clubId: string,
  courtId: string,
  date: string,
  time: string,
  durationMinutes: number,
  excludeId?: string
): Promise<void> {
  const { data } = await supabase
    .from("reservations")
    .select("id, time, duration_minutes")
    .eq("club_id", clubId)
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
  clubId: string,
  reservationId: string
): Promise<Payment[]> {
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("club_id", clubId)
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
  clubId: string,
  phone: string,
  delta: number
): Promise<void> {
  const { error } = await supabase.rpc("adjust_credit_balance", {
    p_club_id: clubId,
    p_phone: phone.trim(),
    p_delta: delta,
  });

  if (error) {
    throw new Error("No se pudo actualizar el saldo a favor del cliente.");
  }
}

type PreparedReservation = {
  court: Court;
  kind: ReservationInput["kind"];
  profeUserId: string | null;
  duration: number;
  price: number;
  /** Personas finales (la 1 es quien reserva; en turnos de profe, el profe). */
  people: { name: string; socio_id: string | null }[];
};

/**
 * Valida y completa un turno (alta o edición): tipo según el rol, profe del club,
 * socios del club, duración (de la cancha o, en torneos, la elegida), franja dentro
 * del horario, sin superposición, y valor fijado con los precios del tipo de cancha.
 */
async function prepareReservation(
  ctx: SessionContext,
  input: ReservationInput,
  existing: Reservation | null
): Promise<PreparedReservation> {
  const { supabase, user, membership } = ctx;
  const clubId = membership!.club_id;

  const court = await fetchCourt(supabase, clubId, input.court_id);
  if (!court || (!court.active && court.id !== existing?.court_id)) {
    throw new Error("La cancha seleccionada no está disponible.");
  }

  // Un profesor solo carga turnos de profe a su nombre.
  const isProfesor = membership!.role === "profesor";
  const kind = isProfesor ? "profe" : input.kind;
  const profeUserId = kind === "profe" ? (isProfesor ? user!.id : input.profe_user_id) : null;

  let people = input.people.map((p) => ({ name: p.name.trim(), socio_id: p.socio_id }));

  if (kind === "profe") {
    const { data: profe } = await supabase
      .from("memberships")
      .select("full_name, email")
      .eq("club_id", clubId)
      .eq("user_id", profeUserId ?? "")
      .eq("role", "profesor")
      .maybeSingle();
    if (!profe) {
      throw new Error("Elegí un profe del club.");
    }
    // El profe es quien reserva; las personas cargadas son sus alumnos.
    people = [{ name: profe.full_name || profe.email, socio_id: null }, ...people].slice(0, MAX_PEOPLE);
  } else if (people.length === 0) {
    throw new Error("Indicá quién reserva el turno.");
  } else if (kind === "torneo" && people.length < 2) {
    throw new Error("Un torneo necesita al menos 2 jugadores.");
  }

  const socioIds = [...new Set(people.map((p) => p.socio_id).filter((id): id is string => !!id))];
  if (socioIds.length > 0) {
    const { data: socios } = await supabase
      .from("socios")
      .select("id")
      .eq("club_id", clubId)
      .is("deleted_at", null)
      .in("id", socioIds);
    if ((socios ?? []).length !== socioIds.length) {
      throw new Error("Alguno de los socios ya no está disponible. Volvé a elegirlo.");
    }
  }

  // Duración: en torneos la elegida; en los demás, la de la cancha (o la que ya tenía el turno).
  const duration =
    kind === "torneo"
      ? input.duration_minutes
      : existing && existing.kind !== "torneo"
        ? existing.duration_minutes
        : court.slot_duration;

  if (!getCourtSlots(court).includes(input.time)) {
    throw new Error("El horario no corresponde a una franja válida de la cancha.");
  }
  if (timeToMinutes(input.time) + duration > timeToMinutes(court.close_time)) {
    throw new Error(`Con ${duration} minutos el turno termina después del cierre de la cancha.`);
  }

  await assertNoOverlap(supabase, clubId, court.id, input.date, input.time, duration, existing?.id);

  // El valor se fija al reservar; en una edición solo cambia si cambian cancha, tipo o duración.
  const unchanged =
    existing &&
    existing.court_id === court.id &&
    existing.kind === kind &&
    existing.duration_minutes === duration;
  const price = unchanged
    ? Number(existing.price)
    : quotePrice(await fetchSportPrices(supabase, clubId, court.type), kind, duration);

  return { court, kind, profeUserId, duration, price, people };
}

/** Reemplaza las personas de un turno. */
async function saveParticipants(
  supabase: SupabaseClient,
  clubId: string,
  reservationId: string,
  people: PreparedReservation["people"]
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("reservation_participants")
    .delete()
    .eq("club_id", clubId)
    .eq("reservation_id", reservationId);
  if (deleteError) return false;

  const { error } = await supabase.from("reservation_participants").insert(
    people.map((person, index) => ({
      club_id: clubId,
      reservation_id: reservationId,
      position: index + 1,
      socio_id: person.socio_id,
      name: person.name,
    }))
  );
  return !error;
}

function validationError(input: ReservationInput): string | null {
  const parsed = reservationInputSchema.safeParse(input);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Datos inválidos.");
}

export async function createReservationAction(
  input: ReservationInput
): Promise<ActionResult> {
  const invalid = validationError(input);
  if (invalid) return { success: false, error: invalid };
  const data = reservationInputSchema.parse(input);

  try {
    const ctx: SessionContext = await requireRole("profesor");
    const { supabase, user, membership } = ctx;
    const clubId = membership!.club_id;

    const prepared = await prepareReservation(ctx, data, null);

    if (data.repeat_weekly) {
      return await createSeries(ctx, data, prepared);
    }

    const { data: created, error } = await supabase
      .from("reservations")
      .insert({
        club_id: clubId,
        court_id: prepared.court.id,
        date: data.date,
        time: data.time,
        duration_minutes: prepared.duration,
        customer_name: prepared.people[0].name,
        phone: data.phone.trim(),
        kind: prepared.kind,
        profe_user_id: prepared.profeUserId,
        price: prepared.price,
        created_by: user!.id,
        updated_by: user!.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: DOUBLE_BOOKING_MESSAGE };
      }
      return { success: false, error: "No se pudo guardar la reserva." };
    }

    if (!(await saveParticipants(supabase, clubId, created.id, prepared.people))) {
      // Compensación: sin personas el turno no queda guardado.
      await supabase.from("reservations").delete().eq("id", created.id).eq("club_id", clubId);
      return { success: false, error: "No se pudieron guardar las personas del turno." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "reservation",
      entityId: created.id,
      action: "reservation.created",
      payload: {
        customer_name: prepared.people[0].name,
        court_id: prepared.court.id,
        date: data.date,
        time: data.time,
        kind: prepared.kind,
        people: prepared.people.map((p) => p.name),
        duration: prepared.duration,
      },
    });

    revalidatePath("/dashboard/reservas");

    const reservation = await fetchReservation(supabase, clubId, created.id);
    return { success: true, reservation: reservation ?? undefined };
  } catch (err) {
    return failure(err, "No se pudo guardar la reserva.");
  }
}

/**
 * Turno fijo semanal: crea la serie y materializa las primeras semanas como turnos
 * comunes (`ensure_series_until`), salteando las fechas en que la cancha está ocupada.
 */
async function createSeries(
  ctx: SessionContext,
  data: ReservationInput,
  prepared: PreparedReservation
): Promise<ActionResult> {
  const { supabase, user, membership } = ctx;
  const clubId = membership!.club_id;
  const [y, m, d] = data.date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const { data: series, error } = await supabase
    .from("reservation_series")
    .insert({
      club_id: clubId,
      court_id: prepared.court.id,
      weekday,
      start_time: data.time,
      duration_minutes: prepared.duration,
      kind: prepared.kind,
      profe_user_id: prepared.profeUserId,
      customer_name: prepared.people[0].name,
      phone: data.phone.trim(),
      participants: prepared.people,
      starts_on: data.date,
      generated_until: addDays(data.date, -1),
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error || !series) {
    return { success: false, error: "No se pudo crear el turno fijo." };
  }

  const { data: skipped, error: generateError } = await supabase.rpc("ensure_series_until", {
    p_club_id: clubId,
    p_until: addDays(data.date, 7 * (SERIES_INITIAL_WEEKS - 1)),
  });

  if (generateError) {
    return { success: false, error: "El turno fijo se creó, pero no se pudieron reservar sus fechas." };
  }

  const skippedDates = ((skipped ?? []) as { series_id: string; skipped_date: string }[])
    .filter((row) => row.series_id === series.id)
    .map((row) => row.skipped_date);

  await writeAudit(supabase, {
    clubId,
    actorId: user!.id,
    entity: "series",
    entityId: series.id,
    action: "series.created",
    payload: {
      customer_name: prepared.people[0].name,
      court_id: prepared.court.id,
      date: data.date,
      time: data.time,
      kind: prepared.kind,
      skipped: skippedDates,
    },
  });

  revalidatePath("/dashboard/reservas");

  const { data: first } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("club_id", clubId)
    .eq("series_id", series.id)
    .eq("date", data.date)
    .maybeSingle();

  return {
    success: true,
    reservation: (first as Reservation | null) ?? undefined,
    skippedDates,
  };
}

export async function updateReservationAction(
  id: string,
  input: ReservationInput
): Promise<ActionResult> {
  const invalid = validationError(input);
  if (invalid) return { success: false, error: invalid };
  const data = reservationInputSchema.parse(input);

  try {
    const ctx: SessionContext = await requireRole("profesor");
    const { supabase, user, membership } = ctx;
    const clubId = membership!.club_id;

    const existing = await fetchReservation(supabase, clubId, id);
    if (!existing) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (existing.status === "cancelled") {
      return {
        success: false,
        error: "La reserva ya fue cancelada y no se puede modificar.",
      };
    }

    const prepared = await prepareReservation(ctx, data, existing);

    const { error } = await supabase
      .from("reservations")
      .update({
        court_id: prepared.court.id,
        date: data.date,
        time: data.time,
        duration_minutes: prepared.duration,
        customer_name: prepared.people[0].name,
        phone: data.phone.trim(),
        kind: prepared.kind,
        profe_user_id: prepared.profeUserId,
        price: prepared.price,
        updated_by: user!.id,
      })
      .eq("id", id)
      .eq("club_id", clubId);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: DOUBLE_BOOKING_MESSAGE };
      }
      return { success: false, error: "No se pudo actualizar la reserva." };
    }

    if (!(await saveParticipants(supabase, clubId, id, prepared.people))) {
      return { success: false, error: "El turno se guardó, pero no se pudieron guardar sus personas." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "reservation",
      entityId: id,
      action: "reservation.updated",
      payload: {
        customer_name: prepared.people[0].name,
        date: data.date,
        time: data.time,
        kind: prepared.kind,
        people: prepared.people.map((p) => p.name),
        duration: prepared.duration,
      },
    });

    revalidatePath("/dashboard/reservas");

    const reservation = await fetchReservation(supabase, clubId, id);
    return { success: true, reservation: reservation ?? undefined };
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
    const clubId = membership!.club_id;

    const reservation = await fetchReservation(supabase, clubId, id);
    if (!reservation) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (reservation.status === "cancelled") {
      return { success: false, error: "La reserva ya estaba cancelada." };
    }

    // Valor fijado al reservar.
    const slotPrice = Number(reservation.price);

    // Política del club (defaults si no configuró).
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("cancel_window_hours, late_penalty_percent")
      .eq("club_id", clubId)
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
    const payments = await fetchPayments(supabase, clubId, id);
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
      .eq("club_id", clubId)
      .select(RESERVATION_SELECT)
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
          .eq("id", payment.id)
          .eq("club_id", clubId);
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
        await adjustCredit(supabase, clubId, phone, delta);
      }
    }

    await writeAudit(supabase, {
      clubId,
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
    const { supabase, user, membership } = ctx;
    const clubId = membership!.club_id;

    const reservation = await fetchReservation(supabase, clubId, reservationId);
    if (!reservation) {
      return { success: false, error: "No se encontró la reserva." };
    }
    if (reservation.status === "cancelled") {
      return {
        success: false,
        error: "La reserva está cancelada y no admite cobros.",
      };
    }

    const court = await fetchCourt(supabase, clubId, reservation.court_id);
    if (!court) {
      return { success: false, error: "No se encontró la cancha." };
    }

    // Idempotencia: revalidar el estado real antes de registrar el cobro.
    const existingPayments = await fetchPayments(supabase, clubId, reservationId);
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
    const slotPrice = Number(reservation.price);
    const amount =
      parsed.data.kind === "seña"
        ? depositFor(await fetchSportPrices(supabase, clubId, court.type), slotPrice)
        : Math.max(0, slotPrice - paidAmount(existingPayments));

    if (parsed.data.kind === "seña" && amount <= 0) {
      return {
        success: false,
        error: "Esta cancha no tiene seña configurada.",
      };
    }

    // Si ya estaba todo cobrado (ej. saldo a favor que cubrió el turno), solo se marca como pagada.
    if (amount > 0) {
      const { error: paymentError } = await supabase.from("payments").insert({
        club_id: clubId,
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
      .eq("club_id", clubId)
      .select(RESERVATION_SELECT)
      .single();

    if (error) {
      return { success: false, error: "No se pudo actualizar la reserva." };
    }

    await writeAudit(supabase, {
      clubId,
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
    const { supabase, user, membership } = ctx;
    const clubId = membership!.club_id;

    const reservation = await fetchReservation(supabase, clubId, reservationId);
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

    const court = await fetchCourt(supabase, clubId, reservation.court_id);
    if (!court) {
      return { success: false, error: "No se encontró la cancha." };
    }

    const { data: creditRow } = await supabase
      .from("credit_balances")
      .select("amount")
      .eq("club_id", clubId)
      .eq("customer_phone", phone)
      .maybeSingle();

    const credit = Number(creditRow?.amount ?? 0);
    if (credit <= 0) {
      return {
        success: false,
        error: "El cliente no tiene saldo a favor disponible.",
      };
    }

    const payments = await fetchPayments(supabase, clubId, reservationId);
    const paid = paidAmount(payments);
    const slotPrice = Number(reservation.price);
    const remaining = Math.max(0, slotPrice - paid);

    if (remaining <= 0) {
      return {
        success: false,
        error: "El turno ya está totalmente pago.",
      };
    }

    const applied = Math.min(credit, remaining);

    await adjustCredit(supabase, clubId, phone, -applied);

    const { error: paymentError } = await supabase.from("payments").insert({
      club_id: clubId,
      reservation_id: reservationId,
      kind: "saldo",
      amount: applied,
      method: "otro",
      created_by: user!.id,
    });

    if (paymentError) {
      // Compensar el descuento del saldo si el registro del pago falló.
      await supabase.rpc("adjust_credit_balance", {
        p_club_id: clubId,
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
      .eq("club_id", clubId)
      .select(RESERVATION_SELECT)
      .single();

    if (error) {
      return { success: false, error: "No se pudo actualizar la reserva." };
    }

    await writeAudit(supabase, {
      clubId,
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

/**
 * Baja de un turno fijo desde una fecha: no se generan más semanas y se liberan las
 * fechas ya reservadas desde ese día que no tengan cobros. Las que tienen cobros (o
 * que el profe no puede cancelar por la ventana de penalidad) quedan activas y se
 * devuelven para gestionarlas a mano.
 */
export async function endSeriesAction(
  seriesId: string,
  fromDate: string
): Promise<ActionResult & { cancelled?: number; kept?: string[] }> {
  const parsed = z
    .object({ seriesId: z.string().uuid(), fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse({ seriesId, fromDate });
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos." };
  }

  try {
    const ctx: SessionContext = await requireRole("profesor");
    const { supabase, user, membership } = ctx;
    const clubId = membership!.club_id;

    const { data: series } = await supabase
      .from("reservation_series")
      .select("id, customer_name, profe_user_id, starts_on, ends_on")
      .eq("id", parsed.data.seriesId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (!series) {
      return { success: false, error: "No se encontró el turno fijo." };
    }
    if (membership!.role === "profesor" && series.profe_user_id !== user!.id) {
      return { success: false, error: "Solo podés dar de baja tus propios turnos fijos." };
    }

    const endsOn = addDays(parsed.data.fromDate, -1);
    const { error: endError } = await supabase
      .from("reservation_series")
      .update({ ends_on: series.ends_on && series.ends_on < endsOn ? series.ends_on : endsOn })
      .eq("id", series.id)
      .eq("club_id", clubId);
    if (endError) {
      return { success: false, error: "No se pudo dar de baja el turno fijo." };
    }

    const { data: upcoming } = await supabase
      .from("reservations")
      .select("id, date")
      .eq("club_id", clubId)
      .eq("series_id", series.id)
      .eq("status", "active")
      .gte("date", parsed.data.fromDate)
      .order("date");

    const ids = (upcoming ?? []).map((r) => r.id as string);
    const { data: paidRows } = ids.length
      ? await supabase
          .from("payments")
          .select("reservation_id")
          .eq("club_id", clubId)
          .eq("released", false)
          .in("reservation_id", ids)
      : { data: [] };
    const withPayments = new Set((paidRows ?? []).map((p) => p.reservation_id as string));

    let cancelled = 0;
    const kept: string[] = [];
    for (const occurrence of upcoming ?? []) {
      if (withPayments.has(occurrence.id as string)) {
        kept.push(occurrence.date as string);
        continue;
      }
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user!.id,
          cancel_reason: "Baja de turno fijo",
          late_cancel: false,
          updated_by: user!.id,
        })
        .eq("id", occurrence.id)
        .eq("club_id", clubId);
      if (error) kept.push(occurrence.date as string);
      else cancelled += 1;
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "series",
      entityId: series.id,
      action: "series.ended",
      payload: { customer_name: series.customer_name, from: parsed.data.fromDate, cancelled, kept },
    });

    revalidatePath("/dashboard/reservas");

    return { success: true, cancelled, kept };
  } catch (err) {
    return failure(err, "No se pudo dar de baja el turno fijo.");
  }
}
