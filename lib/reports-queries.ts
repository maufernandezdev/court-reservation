import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OVERDUE_DAYS,
  addDays,
  type IncomePayment,
  type PeriodRange,
  type ReportReservation,
} from "@/lib/reports";
import type { DayPayment } from "@/lib/daily-overview";
import { amountDue, paidByReservation } from "@/lib/daily-overview";
import type { Reservation } from "@/lib/reservations";

/** El club opera en Argentina (UTC-3, sin horario de verano), igual que Caja. */
const CLUB_OFFSET = "-03:00";
/** PostgREST devuelve como máximo 1000 filas por consulta: se piden por páginas. */
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Trae todas las filas de una consulta paginando de a 1000. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

type IncomeRow = {
  kind: IncomePayment["kind"];
  amount: number;
  reservations: { court_id: string } | { court_id: string }[] | null;
};

const RESERVATION_COLUMNS =
  "id, court_id, date, time, duration_minutes, status, kind, price, payment_status, late_cancel, series_id";

export type PeriodData = {
  reservations: ReportReservation[];
  payments: DayPayment[];
  income: IncomePayment[];
};

/** Turnos del período, sus cobros no liberados y los cobros registrados en esos días. */
export async function loadPeriodData(
  supabase: SupabaseClient,
  clubId: string,
  range: PeriodRange
): Promise<PeriodData> {
  const [reservations, payments, income] = await Promise.all([
    fetchAll<ReportReservation>((from, to) =>
      supabase
        .from("reservations")
        .select(RESERVATION_COLUMNS)
        .eq("club_id", clubId)
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date")
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ reservation_id: string; amount: number; released: boolean }>((from, to) =>
      supabase
        .from("payments")
        .select("reservation_id, amount, released, reservations!inner(date)")
        .eq("club_id", clubId)
        .eq("released", false)
        .gte("reservations.date", range.from)
        .lte("reservations.date", range.to)
        .order("id")
        .range(from, to)
    ),
    fetchAll<IncomeRow>(
      (from, to) =>
        supabase
          .from("payments")
          .select("kind, amount, reservations(court_id)")
          .eq("club_id", clubId)
          .gte("created_at", `${range.from}T00:00:00${CLUB_OFFSET}`)
          .lt("created_at", `${addDays(range.to, 1)}T00:00:00${CLUB_OFFSET}`)
          .order("id")
          .range(from, to) as unknown as PromiseLike<PageResult<IncomeRow>>
    ),
  ]);

  return {
    reservations,
    payments: payments.map((p) => ({ reservation_id: p.reservation_id, amount: p.amount, released: p.released })),
    income: income.map((p) => {
      // La relación es muchos a uno: PostgREST devuelve un objeto (el cliente sin tipos la modela como lista).
      const reservation = Array.isArray(p.reservations) ? p.reservations[0] : p.reservations;
      return { kind: p.kind, amount: Number(p.amount), court_id: reservation?.court_id ?? null };
    }),
  };
}

export type Overdue = { count: number; amount: number };

/** Turnos de los últimos 30 días, ya pasados y activos, con saldo sin cobrar. */
export async function loadOverdue(supabase: SupabaseClient, clubId: string, today: string): Promise<Overdue> {
  const from = addDays(today, -OVERDUE_DAYS);
  const to = addDays(today, -1);

  const [reservations, payments] = await Promise.all([
    fetchAll<Pick<Reservation, "id" | "price" | "status" | "payment_status">>((start, end) =>
      supabase
        .from("reservations")
        .select("id, price, status, payment_status")
        .eq("club_id", clubId)
        .eq("status", "active")
        .neq("payment_status", "pagada")
        .gte("date", from)
        .lte("date", to)
        .order("id")
        .range(start, end)
    ),
    fetchAll<DayPayment>((start, end) =>
      supabase
        .from("payments")
        .select("reservation_id, amount, released, reservations!inner(date, status, payment_status)")
        .eq("club_id", clubId)
        .eq("released", false)
        .eq("reservations.status", "active")
        .neq("reservations.payment_status", "pagada")
        .gte("reservations.date", from)
        .lte("reservations.date", to)
        .order("id")
        .range(start, end)
    ),
  ]);

  const paid = paidByReservation(payments);
  let count = 0;
  let amount = 0;
  for (const r of reservations) {
    const due = amountDue(r as Reservation, paid.get(r.id) ?? 0);
    if (due > 0) {
      count += 1;
      amount += due;
    }
  }
  return { count, amount };
}
