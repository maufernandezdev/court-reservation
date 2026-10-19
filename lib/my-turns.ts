import { addDays } from "@/lib/reports";
import type { Reservation } from "@/lib/reservations";

/**
 * Vistas de "Mis turnos" del profesor (ver specs/my-turns). Funciones puras de fechas `YYYY-MM-DD`
 * (días calendario del club, sin zona horaria) y de agrupado.
 */

export const MY_TURNS_VIEWS = ["hoy", "semana", "historial"] as const;
export type MyTurnsView = (typeof MY_TURNS_VIEWS)[number];

export const MY_TURNS_VIEW_LABELS: Record<MyTurnsView, string> = {
  hoy: "Hoy",
  semana: "Semana",
  historial: "Historial",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export const isMonthKey = (value: unknown): value is string => typeof value === "string" && MONTH_RE.test(value);

/** Lunes de la semana de `dateKey` (la semana va de lunes a domingo). */
export function mondayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return addDays(dateKey, -((dow + 6) % 7));
}

/** Los siete días de la semana que empieza en `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Primer y último día (`YYYY-MM-DD`) de un mes `YYYY-MM`. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Mes siguiente o anterior (`delta` = ±1) de un mes `YYYY-MM`. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "lun 19" para el encabezado de un día. */
export function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", { weekday: "short", timeZone: "UTC" });
  return `${weekday.replace(".", "")} ${d}`;
}

/** "lunes 19 de octubre" para un título largo. */
export function longDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "octubre de 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
}

type TurnLike = Pick<Reservation, "date" | "time" | "status" | "duration_minutes">;

/** Turnos agrupados por fecha; cada grupo ordenado por horario. `desc` ordena las fechas de la más nueva a la más vieja. */
export function groupByDate<T extends TurnLike>(turns: T[], desc = false): { date: string; turns: T[] }[] {
  const map = new Map<string, T[]>();
  for (const turn of turns) map.set(turn.date, [...(map.get(turn.date) ?? []), turn]);
  return [...map.entries()]
    .sort(([a], [b]) => (desc ? b.localeCompare(a) : a.localeCompare(b)))
    .map(([date, list]) => ({ date, turns: [...list].sort((a, b) => a.time.localeCompare(b.time)) }));
}

/** Totales de un conjunto de turnos: los activos y sus horas, y los cancelados. */
export function summarizeTurns(turns: TurnLike[]): { active: number; cancelled: number; minutes: number } {
  const active = turns.filter((t) => t.status === "active");
  return {
    active: active.length,
    cancelled: turns.length - active.length,
    minutes: active.reduce((sum, t) => sum + t.duration_minutes, 0),
  };
}
