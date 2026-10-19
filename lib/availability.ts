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

/** Horario de apertura y cierre del club ("HH:MM"): vale para todas sus canchas. */
export type ClubHours = {
  open_time: string;
  close_time: string;
};

export const DEFAULT_CLUB_HOURS: ClubHours = { open_time: "09:00", close_time: "22:00" };

/** Los turnos empiezan cada 30 minutos y duran de 30 min a 6 h, en pasos de 30. */
export const START_STEP_MINUTES = 30;
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 360;
/** Duración con la que arranca un turno nuevo (el torneo usa la de Políticas). */
export const DEFAULT_DURATION_MINUTES = 60;

/** Horarios en que puede empezar un turno de esa duración: cada 30 min, sin pasar del cierre. */
export function startTimes(hours: ClubHours, durationMinutes = MIN_DURATION_MINUTES): string[] {
  const start = timeToMinutes(hours.open_time);
  const end = timeToMinutes(hours.close_time);
  const times: string[] = [];
  for (let t = start; t + durationMinutes <= end; t += START_STEP_MINUTES) {
    times.push(minutesToTime(t));
  }
  return times;
}

/** ¿Un turno que empieza en `time` y dura `durationMinutes` entra en el horario del club? */
export function fitsClubHours(hours: ClubHours, time: string, durationMinutes: number): boolean {
  const start = timeToMinutes(time);
  return (
    start >= timeToMinutes(hours.open_time) &&
    start + durationMinutes <= timeToMinutes(hours.close_time) &&
    (start - timeToMinutes(hours.open_time)) % START_STEP_MINUTES === 0
  );
}

/**
 * Primer horario para "Nuevo turno": la próxima media hora desde `fromMinutes` (a las 19:44, las
 * 20:00; p. ej. la hora actual en el día de hoy) o, si no se indica, la apertura. Siempre dentro
 * del horario del club.
 */
export function firstStartFrom(hours: ClubHours, fromMinutes?: number): string {
  const open = timeToMinutes(hours.open_time);
  const lastStart = Math.max(open, timeToMinutes(hours.close_time) - MIN_DURATION_MINUTES);
  if (fromMinutes === undefined) return minutesToTime(open);
  const stepped = open + Math.ceil(Math.max(0, fromMinutes - open) / START_STEP_MINUTES) * START_STEP_MINUTES;
  return minutesToTime(Math.min(Math.max(open, stepped), lastStart));
}

/**
 * Duración máxima de un turno que empieza en `time`: hasta 6 h, el cierre del club y el siguiente
 * turno activo de la cancha (`courtReservations`: los de esa cancha y fecha, sin el que se edita).
 * 0 si la hora ya está ocupada o no queda lugar para 30 minutos.
 */
export function maxDurationAt(
  hours: ClubHours,
  courtReservations: Pick<Reservation, "time" | "duration_minutes" | "status">[],
  time: string
): number {
  const start = timeToMinutes(time);
  let limit = Math.min(MAX_DURATION_MINUTES, timeToMinutes(hours.close_time) - start);
  for (const r of courtReservations) {
    if (r.status !== "active") continue;
    const s = timeToMinutes(r.time);
    const e = s + r.duration_minutes;
    if (s <= start && start < e) return 0;
    if (s > start) limit = Math.min(limit, s - start);
  }
  const stepped = Math.floor(limit / MIN_DURATION_MINUTES) * MIN_DURATION_MINUTES;
  return stepped >= MIN_DURATION_MINUTES ? stepped : 0;
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
  to?: string; // "HH:MM" exclusive (fin de la franja buscada)
  type?: Court["type"] | "all";
  /** Duración buscada en minutos (por defecto 1 hora). */
  duration?: number;
};

/**
 * Busca los horarios en que cabe un turno de la duración pedida, para una fecha. Solo considera
 * reservas activas.
 */
export function findFreeSlots(
  courts: Court[],
  activeReservations: Reservation[],
  hours: ClubHours,
  filter: AvailabilityFilter
): FreeSlot[] {
  const from = filter.from ? timeToMinutes(filter.from) : null;
  const to = filter.to ? timeToMinutes(filter.to) : null;
  const duration = filter.duration ?? DEFAULT_DURATION_MINUTES;
  const times = startTimes(hours, duration);

  const free: FreeSlot[] = [];

  for (const court of courts) {
    if (filter.type && filter.type !== "all" && court.type !== filter.type) continue;

    const courtReservations = activeReservations.filter((r) => r.court_id === court.id);

    for (const time of times) {
      const slotStart = timeToMinutes(time);

      if (from !== null && slotStart < from) continue;
      if (to !== null && slotStart + duration > to) continue;

      const occupied = courtReservations.some((r) =>
        rangesOverlap(slotStart, duration, timeToMinutes(r.time), r.duration_minutes)
      );

      if (!occupied) free.push({ court, time });
    }
  }

  return free.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Primera cancha y horario para "Nuevo turno": desde la próxima media hora (o la apertura), el primer
 * hueco donde entra una hora libre y, si no hay, uno de al menos media hora. Con varias canchas libres
 * a esa hora gana la primera de la lista; una cancha ocupada solo aparece al cambiar a un horario en
 * que tenga hueco. Null si no queda ninguna.
 */
export function firstFreeStart(
  courts: Court[],
  activeReservations: Reservation[],
  hours: ClubHours,
  fromMinutes?: number
): { court: Court; time: string } | null {
  const from = firstStartFrom(hours, fromMinutes);
  for (const duration of [DEFAULT_DURATION_MINUTES, MIN_DURATION_MINUTES]) {
    const [first] = findFreeSlots(courts, activeReservations, hours, { from, duration });
    if (first) return { court: first.court, time: first.time };
  }
  return null;
}

export type AvailabilityMessageSlot = {
  /** "19:00" o "19:00 – 21:00" */
  time: string;
  /** Nombre de la cancha (y lo que haga falta, ej. "Cancha 3 · Polvo") */
  label: string;
};

/**
 * Texto listo para pegar en WhatsApp con turnos libres (Hoy y buscador).
 * `dayLabel`: "hoy", "mañana", "el jueves 8"…; `detail`: ej. "tenis, 60 min".
 */
export function buildAvailabilityMessage({
  dayLabel,
  detail,
  slots,
}: {
  dayLabel: string;
  detail?: string;
  slots: AvailabilityMessageSlot[];
}): string {
  if (slots.length === 0) {
    return `Para ${dayLabel} no nos quedan canchas libres desde ese horario.`;
  }
  const header = `¡Hola! Para ${dayLabel} tenemos libre${detail ? ` (${detail})` : ""}:`;
  const lines = slots.map((slot) => `• ${slot.time} – ${slot.label}`);
  return [header, ...lines, "¿Te reservo alguno?"].join("\n");
}
