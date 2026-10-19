import type { Court } from "@/lib/courts";
import type { Reservation } from "@/lib/reservations";
import { isNight } from "@/lib/pricing";
import { amountDue, paidByReservation, type DayPayment } from "@/lib/daily-overview";
import { timeToMinutes, type ClubHours } from "@/lib/availability";

/**
 * Reporte de rendimiento de las canchas por período (ver specs/court-reports). Funciones puras:
 * reciben turnos, cobros, canchas y el horario del club, y devuelven lo que muestra la pantalla.
 */

export const REPORT_PERIODS = ["hoy", "ayer", "7d", "mes"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  "7d": "Últimos 7 días",
  mes: "Este mes",
};

/** Cuántos días hacia atrás mira "Para revisar" a la hora de buscar turnos sin cobrar. */
export const OVERDUE_DAYS = 30;

/** Suma `days` a una fecha `YYYY-MM-DD` (días calendario, sin zona horaria). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type PeriodRange = {
  /** Primer día incluido (`YYYY-MM-DD`). */
  from: string;
  /** Último día incluido; nunca pasa de hoy salvo "hoy". */
  to: string;
  /** Cantidad de días del período. */
  days: number;
};

/** Rango de fechas de un período, en días del club (`today` es la fecha de hoy en su horario). */
export function periodRange(period: ReportPeriod, today: string): PeriodRange {
  switch (period) {
    case "ayer": {
      const day = addDays(today, -1);
      return { from: day, to: day, days: 1 };
    }
    case "7d":
      return { from: addDays(today, -6), to: today, days: 7 };
    case "mes": {
      const from = `${today.slice(0, 8)}01`;
      return { from, to: today, days: Number(today.slice(8, 10)) };
    }
    default:
      return { from: today, to: today, days: 1 };
  }
}

export type ReportReservation = Pick<
  Reservation,
  | "id"
  | "court_id"
  | "date"
  | "time"
  | "duration_minutes"
  | "status"
  | "kind"
  | "price"
  | "payment_status"
  | "late_cancel"
  | "series_id"
>;

/** Cobro que entró en el período: señas y cobros (el saldo a favor aplicado no es plata nueva). */
export type IncomePayment = {
  kind: "seña" | "total" | "saldo";
  amount: number;
  court_id: string | null;
};

export type CourtReportRow = {
  court: Court;
  bookings: number;
  bookedMinutes: number;
  occupancyPercent: number;
  income: number;
};

export type HourRow = { hour: number; bookings: number };

export type ReportInput = {
  courts: Court[];
  /** Turnos con fecha dentro del período (de cualquier estado). */
  reservations: ReportReservation[];
  /** Cobros no liberados de esos turnos, para calcular lo que falta cobrar. */
  payments: DayPayment[];
  /** Cobros registrados dentro del período. */
  income: IncomePayment[];
  hours: ClubHours;
  nightStartsAt: string;
  range: PeriodRange;
  today: string;
};

export type Report = {
  income: number;
  incomeCount: number;
  activeCount: number;
  cancelledCount: number;
  lateCancelledCount: number;
  occupancyPercent: number;
  bookedMinutes: number;
  /** Lo que falta cobrar de turnos activos del período que ya empezaron (o son de hoy). */
  due: number;
  dueCount: number;
  courts: CourtReportRow[];
  /** Horas con turnos, de la más pedida a la menos pedida. */
  byHour: HourRow[];
  byKind: { standard: number; profe: number; torneo: number; fixed: number };
  /** Turnos activos que empiezan en el horario de noche. */
  nightCount: number;
  topCourt: CourtReportRow | null;
  topHour: HourRow | null;
};

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function buildReport(input: ReportInput): Report {
  const { courts, reservations, payments, income, hours, nightStartsAt, range, today } = input;
  const courtIds = new Set(courts.map((c) => c.id));
  const active = reservations.filter((r) => r.status === "active" && courtIds.has(r.court_id));
  const cancelled = reservations.filter((r) => r.status === "cancelled" && courtIds.has(r.court_id));

  const minutesPerCourt = range.days * Math.max(0, timeToMinutes(hours.close_time) - timeToMinutes(hours.open_time));
  const bookedMinutes = active.reduce((sum, r) => sum + r.duration_minutes, 0);

  const realIncome = income.filter((p) => p.kind !== "saldo");
  const incomeByCourt = new Map<string, number>();
  for (const p of realIncome) {
    if (!p.court_id) continue;
    incomeByCourt.set(p.court_id, (incomeByCourt.get(p.court_id) ?? 0) + Number(p.amount));
  }

  const courtRows: CourtReportRow[] = courts
    .map((court) => {
      const mine = active.filter((r) => r.court_id === court.id);
      const minutes = mine.reduce((sum, r) => sum + r.duration_minutes, 0);
      return {
        court,
        bookings: mine.length,
        bookedMinutes: minutes,
        occupancyPercent: percent(minutes, minutesPerCourt),
        income: incomeByCourt.get(court.id) ?? 0,
      };
    })
    .sort((a, b) => b.occupancyPercent - a.occupancyPercent || b.bookings - a.bookings || a.court.name.localeCompare(b.court.name));

  const hourCounts = new Map<number, number>();
  for (const r of active) {
    const hour = Math.floor(timeToMinutes(r.time) / 60);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const byHour = [...hourCounts.entries()]
    .map(([hour, bookings]) => ({ hour, bookings }))
    .sort((a, b) => b.bookings - a.bookings || a.hour - b.hour);

  const paid = paidByReservation(payments);
  let due = 0;
  let dueCount = 0;
  for (const r of active) {
    if (r.date > today) continue;
    const amount = amountDue(r as Reservation, paid.get(r.id) ?? 0);
    if (amount > 0) {
      due += amount;
      dueCount += 1;
    }
  }

  return {
    income: realIncome.reduce((sum, p) => sum + Number(p.amount), 0),
    incomeCount: realIncome.length,
    activeCount: active.length,
    cancelledCount: cancelled.length,
    lateCancelledCount: cancelled.filter((r) => r.late_cancel).length,
    occupancyPercent: percent(bookedMinutes, minutesPerCourt * courts.length),
    bookedMinutes,
    due,
    dueCount,
    courts: courtRows,
    byHour,
    byKind: {
      standard: active.filter((r) => r.kind === "standard").length,
      profe: active.filter((r) => r.kind === "profe").length,
      torneo: active.filter((r) => r.kind === "torneo").length,
      fixed: active.filter((r) => r.series_id !== null).length,
    },
    nightCount: active.filter((r) => isNight(r.time, nightStartsAt)).length,
    topCourt: courtRows.find((row) => row.bookings > 0) ?? null,
    topHour: byHour[0] ?? null,
  };
}

/** "3 h", "1 h 30", "45 min": horas reservadas para mostrar. */
export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m}`;
}

export type SummaryInput = {
  clubName: string;
  periodLabel: string;
  report: Report;
  formatMoney: (amount: number) => string;
};

/** Texto para pegar en WhatsApp con los números del período. */
export function buildWhatsappSummary({ clubName, periodLabel, report, formatMoney }: SummaryInput): string {
  const lines = [
    `*Resumen · ${clubName} · ${periodLabel}*`,
    `Ingresos: ${formatMoney(report.income)}`,
    `Turnos: ${report.activeCount}${report.cancelledCount ? ` (${report.cancelledCount} ${report.cancelledCount === 1 ? "cancelado" : "cancelados"})` : ""}`,
    `Ocupación: ${report.occupancyPercent}%`,
  ];
  if (report.due > 0) lines.push(`Por cobrar: ${formatMoney(report.due)} (${report.dueCount} ${report.dueCount === 1 ? "turno" : "turnos"})`);
  if (report.topCourt) lines.push(`Cancha más usada: ${report.topCourt.court.name} (${report.topCourt.occupancyPercent}%)`);
  if (report.topHour) {
    lines.push(`Horario más pedido: ${String(report.topHour.hour).padStart(2, "0")}:00 (${report.topHour.bookings} ${report.topHour.bookings === 1 ? "turno" : "turnos"})`);
  }
  return lines.join("\n");
}
