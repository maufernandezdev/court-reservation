import type { Court } from "@/lib/courts";
import type { Reservation } from "@/lib/reservations";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * PostgREST devuelve columnas `time` como "HH:MM:SS"; la app trabaja con "HH:MM".
 */
export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Franjas disponibles de una cancha según su horario y duración de turno. */
export function getCourtSlots(
  court: Pick<Court, "open_time" | "close_time" | "slot_duration">
): string[] {
  const start = timeToMinutes(court.open_time);
  const end = timeToMinutes(court.close_time);
  const slots: string[] = [];
  for (let t = start; t + court.slot_duration <= end; t += court.slot_duration) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/** Solapamiento entre dos intervalos de tiempo (en minutos desde 00:00). */
export function rangesOverlap(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number
): boolean {
  return startA < startB + durationB && startB < startA + durationA;
}

/** ¿La reserva (activa) cubre la franja `time`? */
export function reservationCoversSlot(
  reservation: Pick<Reservation, "time" | "duration_minutes" | "status">,
  time: string
): boolean {
  if (reservation.status !== "active") return false;
  const slotStart = timeToMinutes(time);
  const resStart = timeToMinutes(reservation.time);
  return (
    resStart <= slotStart &&
    slotStart < resStart + reservation.duration_minutes
  );
}

export type FreeSlot = {
  court: Court;
  time: string;
};

export type AvailabilityFilter = {
  from?: string; // "HH:MM" inclusive
  to?: string; // "HH:MM" exclusive (fin de franja buscada)
  type?: Court["type"] | "all";
};

/**
 * Busca franjas libres para una fecha. Solo considera reservas activas.
 */
export function findFreeSlots(
  courts: Court[],
  activeReservations: Reservation[],
  filter: AvailabilityFilter
): FreeSlot[] {
  const from = filter.from ? timeToMinutes(filter.from) : null;
  const to = filter.to ? timeToMinutes(filter.to) : null;

  const free: FreeSlot[] = [];

  for (const court of courts) {
    if (filter.type && filter.type !== "all" && court.type !== filter.type)
      continue;

    const courtReservations = activeReservations.filter(
      (r) => r.court_id === court.id
    );

    for (const time of getCourtSlots(court)) {
      const slotStart = timeToMinutes(time);
      const slotEnd = slotStart + court.slot_duration;

      if (from !== null && slotStart < from) continue;
      if (to !== null && slotEnd > to) continue;

      const occupied = courtReservations.some((r) =>
        rangesOverlap(
          slotStart,
          court.slot_duration,
          timeToMinutes(r.time),
          r.duration_minutes
        )
      );

      if (!occupied) free.push({ court, time });
    }
  }

  return free.sort((a, b) => a.time.localeCompare(b.time));
}
