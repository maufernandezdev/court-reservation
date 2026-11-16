import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CASH_CATEGORY_LABELS,
  CASH_OUT_CATEGORIES,
  dayRange,
  summarizeCashDay,
  type CashDaySummary,
  type CashMovement,
  type CashOutCategory,
} from "@/lib/cash";
import { amountDue, paidByReservation, type DayPayment } from "@/lib/daily-overview";
import { timeToMinutes } from "@/lib/availability";
import type { Payment, Reservation, ReservationKind } from "@/lib/reservations";

/**
 * Cierre del día (Reportes): lo mismo que la planilla de papel al final del día.
 * Ingresos, egresos, Mercado Pago y efectivo en caja salen de `summarizeCashDay`, como en Caja.
 */

export const INCOME_ORIGINS = ["standard", "profe", "torneo", "accesorio", "otro_ingreso"] as const;
export type IncomeOrigin = (typeof INCOME_ORIGINS)[number];

export const INCOME_ORIGIN_LABELS: Record<IncomeOrigin, string> = {
  standard: "Turnos del público",
  profe: "Turnos de profes",
  torneo: "Turnos de torneo",
  accesorio: "Accesorios",
  otro_ingreso: "Otros ingresos",
};

export type DayClose = {
  date: string;
  cash: CashDaySummary;
  incomeByOrigin: Record<IncomeOrigin, number>;
  expensesByCategory: { category: CashOutCategory; label: string; amount: number }[];
  playedCount: number;
  cancelledCount: number;
  dueCount: number;
  dueAmount: number;
};

type ClosePayment = Pick<Payment, "kind" | "amount" | "method"> & { reservation_kind: ReservationKind | null };
type CloseReservation = Pick<
  Reservation,
  "id" | "time" | "duration_minutes" | "status" | "payment_status" | "price"
>;

export function buildDayClose(input: {
  date: string;
  opening: number;
  payments: ClosePayment[];
  movements: CashMovement[];
  reservations: CloseReservation[];
  reservationPayments: DayPayment[];
  /** Minutos del día actual si `date` es hoy; null si es otro día. */
  nowMinutes: number | null;
}): DayClose {
  const cash = summarizeCashDay({ opening: input.opening, payments: input.payments, movements: input.movements });

  const incomeByOrigin = Object.fromEntries(INCOME_ORIGINS.map((o) => [o, 0])) as Record<IncomeOrigin, number>;
  for (const p of input.payments) {
    if (p.kind === "saldo") continue;
    const origin: IncomeOrigin = p.reservation_kind ?? "standard";
    incomeByOrigin[origin] += Number(p.amount);
  }
  for (const m of input.movements) {
    if (m.voided || m.type !== "in") continue;
    incomeByOrigin[m.category === "accesorio" ? "accesorio" : "otro_ingreso"] += Number(m.amount);
  }

  const expensesByCategory = CASH_OUT_CATEGORIES.map((category) => ({
    category,
    label: CASH_CATEGORY_LABELS[category],
    amount: input.movements
      .filter((m) => !m.voided && m.type === "out" && m.category === category)
      .reduce((sum, m) => sum + Number(m.amount), 0),
  })).filter((row) => row.amount > 0);

  const active = input.reservations.filter((r) => r.status === "active");
  const played = active.filter((r) => input.nowMinutes === null || timeToMinutes(r.time) <= input.nowMinutes);
  const paid = paidByReservation(input.reservationPayments);
  let dueCount = 0;
  let dueAmount = 0;
  for (const r of active) {
    const due = amountDue(r as Reservation, paid.get(r.id) ?? 0);
    if (due > 0) {
      dueCount += 1;
      dueAmount += due;
    }
  }

  return {
    date: input.date,
    cash,
    incomeByOrigin,
    expensesByCategory,
    playedCount: played.length,
    cancelledCount: input.reservations.length - active.length,
    dueCount,
    dueAmount: Math.round(dueAmount * 100) / 100,
  };
}

/** Datos del cierre de un día: cobros, movimientos, cambio y turnos de esa fecha. */
export async function loadDayClose(
  supabase: SupabaseClient,
  clubId: string,
  date: string,
  nowMinutes: number | null
): Promise<DayClose> {
  const range = dayRange(date);
  const [paymentsRes, movementsRes, openingRes, reservationsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("kind, amount, method, reservations(kind)")
      .eq("club_id", clubId)
      .gte("created_at", range.from)
      .lt("created_at", range.to),
    supabase.from("cash_movements").select("*").eq("club_id", clubId).eq("date", date),
    supabase.from("cash_openings").select("amount").eq("club_id", clubId).eq("date", date).maybeSingle(),
    supabase
      .from("reservations")
      .select("id, time, duration_minutes, status, payment_status, price")
      .eq("club_id", clubId)
      .eq("date", date),
  ]);
  const error = paymentsRes.error ?? movementsRes.error ?? reservationsRes.error;
  if (error) throw new Error(error.message);

  const reservations = (reservationsRes.data ?? []) as CloseReservation[];
  const ids = reservations.filter((r) => r.status === "active").map((r) => r.id);
  const { data: reservationPayments } = ids.length
    ? await supabase
        .from("payments")
        .select("reservation_id, amount, released")
        .eq("club_id", clubId)
        .eq("released", false)
        .in("reservation_id", ids)
    : { data: [] };

  type Row = Pick<Payment, "kind" | "amount" | "method"> & {
    reservations: { kind: ReservationKind } | { kind: ReservationKind }[] | null;
  };
  const payments = ((paymentsRes.data ?? []) as unknown as Row[]).map((p) => {
    const r = Array.isArray(p.reservations) ? p.reservations[0] : p.reservations;
    return { kind: p.kind, amount: p.amount, method: p.method, reservation_kind: r?.kind ?? null };
  });

  return buildDayClose({
    date,
    opening: Number(openingRes.data?.amount ?? 0),
    payments,
    movements: (movementsRes.data ?? []) as CashMovement[],
    reservations,
    reservationPayments: (reservationPayments ?? []) as DayPayment[],
    nowMinutes,
  });
}

/** Líneas del cierre para el resumen de WhatsApp. */
export function dayCloseLines(close: DayClose, formatMoney: (n: number) => string, label: string): string[] {
  const lines = [
    `*Cierre del día · ${label}*`,
    `Ingresos: ${formatMoney(close.cash.incomeTotal)}`,
    `Egresos: ${formatMoney(close.cash.expenseTotal)}`,
    `Mercado Pago: ${formatMoney(close.cash.income.mercado_pago)}`,
    `Efectivo en caja: ${formatMoney(close.cash.cashOnHand)}`,
  ];
  const origins = INCOME_ORIGINS.filter((o) => close.incomeByOrigin[o] > 0).map(
    (o) => `${INCOME_ORIGIN_LABELS[o]} ${formatMoney(close.incomeByOrigin[o])}`
  );
  if (origins.length) lines.push(`Ingresos por origen: ${origins.join(" · ")}`);
  if (close.expensesByCategory.length) {
    lines.push(`Egresos por categoría: ${close.expensesByCategory.map((e) => `${e.label} ${formatMoney(e.amount)}`).join(" · ")}`);
  }
  lines.push(
    `Turnos jugados: ${close.playedCount}${close.cancelledCount ? ` · cancelados: ${close.cancelledCount}` : ""}${close.dueCount ? ` · falta cobrar ${formatMoney(close.dueAmount)} (${close.dueCount})` : ""}`
  );
  return lines;
}
