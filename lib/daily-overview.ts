import type { Court } from "@/lib/courts";
import type { Payment, Reservation } from "@/lib/reservations";
import { minutesToTime, timeToMinutes } from "@/lib/availability";

/**
 * Cálculos de la pantalla Hoy (ver specs/daily-overview). Funciones puras:
 * reciben canchas, turnos y cobros del día y la hora actual en minutos.
 */

export type DayPayment = Pick<Payment, "reservation_id" | "amount" | "released">;

export type DaySummary = {
  activeCount: number;
  cancelledCount: number;
  /** Turnos activos que todavía no empezaron. */
  upcomingCount: number;
  /** 0–100: minutos reservados / minutos abiertos de las canchas activas. */
  occupancyPercent: number;
  /** Suma de cobros no liberados de los turnos del día (incluye retenciones de cancelados). */
  collected: number;
  /** Lo que falta cobrar de turnos activos no pagados. */
  pending: number;
  pendingCount: number;
};

/** Total cobrado (no liberado) por turno. */
export function paidByReservation(payments: DayPayment[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (p.released) continue;
    map.set(p.reservation_id, (map.get(p.reservation_id) ?? 0) + Number(p.amount));
  }
  return map;
}

/** Saldo pendiente de un turno activo (0 si está pagado o cancelado), sobre el valor fijado. */
export function amountDue(reservation: Reservation, paid: number): number {
  if (reservation.status !== "active" || reservation.payment_status === "pagada") return 0;
  return Math.max(0, Number(reservation.price) - paid);
}

export function computeDaySummary(
  courts: Court[],
  reservations: Reservation[],
  payments: DayPayment[],
  nowMinutes: number
): DaySummary {
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const active = reservations.filter((r) => r.status === "active" && courtById.has(r.court_id));
  const paid = paidByReservation(payments);

  const openMinutes = courts.reduce(
    (sum, c) => sum + Math.max(0, timeToMinutes(c.close_time) - timeToMinutes(c.open_time)),
    0
  );
  const bookedMinutes = active.reduce((sum, r) => sum + r.duration_minutes, 0);

  let pending = 0;
  let pendingCount = 0;
  for (const r of active) {
    const due = amountDue(r, paid.get(r.id) ?? 0);
    if (due > 0) {
      pending += due;
      pendingCount += 1;
    }
  }

  const dayIds = new Set(reservations.map((r) => r.id));
  const collected = payments
    .filter((p) => !p.released && dayIds.has(p.reservation_id))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    activeCount: active.length,
    cancelledCount: reservations.filter((r) => r.status === "cancelled").length,
    upcomingCount: active.filter((r) => timeToMinutes(r.time) > nowMinutes).length,
    occupancyPercent: openMinutes ? Math.round((bookedMinutes / openMinutes) * 100) : 0,
    collected,
    pending,
    pendingCount,
  };
}

export type CourtNow =
  | { kind: "busy"; reservation: Reservation; endsAt: string }
  | { kind: "free"; until: string }
  | { kind: "closed"; opensAt: string | null };

/** Estado de una cancha en el minuto `nowMinutes`. */
export function courtStatusNow(
  court: Court,
  reservations: Reservation[],
  nowMinutes: number
): CourtNow {
  const open = timeToMinutes(court.open_time);
  const close = timeToMinutes(court.close_time);
  const mine = reservations
    .filter((r) => r.status === "active" && r.court_id === court.id)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (nowMinutes < open) return { kind: "closed", opensAt: court.open_time };
  if (nowMinutes >= close) return { kind: "closed", opensAt: null };

  const current = mine.find((r) => {
    const start = timeToMinutes(r.time);
    return start <= nowMinutes && nowMinutes < start + r.duration_minutes;
  });
  if (current) {
    return {
      kind: "busy",
      reservation: current,
      endsAt: minutesToTime(timeToMinutes(current.time) + current.duration_minutes),
    };
  }

  const next = mine.find((r) => timeToMinutes(r.time) > nowMinutes);
  return { kind: "free", until: next ? next.time : court.close_time };
}

/** Turnos activos que empiezan después de `nowMinutes`, por horario. */
export function upcomingReservations(
  reservations: Reservation[],
  nowMinutes: number
): Reservation[] {
  return reservations
    .filter((r) => r.status === "active" && timeToMinutes(r.time) > nowMinutes)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export type FreeGap = {
  court: Court;
  start: string;
  end: string;
};

/**
 * Huecos libres desde `fromMinutes` (redondeado a la media hora siguiente)
 * hasta el cierre de cada cancha. Solo huecos donde entra al menos un turno.
 */
export function freeGaps(
  courts: Court[],
  reservations: Reservation[],
  fromMinutes: number
): FreeGap[] {
  const from = Math.ceil(fromMinutes / 30) * 30;
  const gaps: FreeGap[] = [];

  for (const court of courts) {
    const close = timeToMinutes(court.close_time);
    let cursor = Math.max(from, timeToMinutes(court.open_time));
    const busy = reservations
      .filter((r) => r.status === "active" && r.court_id === court.id)
      .map((r) => [timeToMinutes(r.time), timeToMinutes(r.time) + r.duration_minutes] as const)
      .sort((a, b) => a[0] - b[0]);

    const pushGap = (start: number, end: number) => {
      if (end - start >= court.slot_duration) {
        gaps.push({ court, start: minutesToTime(start), end: minutesToTime(end) });
      }
    };

    for (const [start, end] of busy) {
      if (end <= cursor) continue;
      if (start > cursor) pushGap(cursor, Math.min(start, close));
      cursor = Math.max(cursor, end);
    }
    if (cursor < close) pushGap(cursor, close);
  }

  return gaps.sort(
    (a, b) => a.start.localeCompare(b.start) || a.court.name.localeCompare(b.court.name)
  );
}
