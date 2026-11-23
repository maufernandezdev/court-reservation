import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CASH_CATEGORY_LABELS,
  CASH_OUT_CATEGORIES,
  CLUB_OFFSET,
  type CashMovement,
  type CashOutCategory,
} from "@/lib/cash";
import { INCOME_ORIGINS, INCOME_ORIGIN_LABELS, type IncomeOrigin } from "@/lib/day-close";
import { fetchAll } from "@/lib/reports-queries";
import { PAYMENT_METHODS, type Payment, type PaymentMethod, type ReservationKind } from "@/lib/reservations";

/**
 * Reporte mensual (Reportes): ingresos, egresos y balance del mes, con a quién fue cada egreso.
 * Mismo criterio que Caja y el cierre del día: los cobros de turnos cuentan el día que se cobraron
 * (el saldo a favor aplicado no es plata nueva), los movimientos por su fecha y los anulados no suman.
 */

/** "2026-11" → primer día, último día y el siguiente mes. */
export function monthBounds(month: string): { from: string; to: string; next: string } {
  const [y, m] = month.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(new Date(Date.UTC(y, m - 1, 1))),
    to: iso(new Date(Date.UTC(y, m, 0))),
    next: iso(new Date(Date.UTC(y, m, 1))),
  };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type ByMethod = Record<PaymentMethod, number>;
const emptyByMethod = () => Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as ByMethod;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type ExpenseLine = Pick<CashMovement, "id" | "date" | "category" | "counterparty" | "note" | "method"> & {
  amount: number;
};

export type ExpenseGroup = {
  category: CashOutCategory;
  label: string;
  total: number;
  /** A quién fue, de mayor a menor ("Sin especificar" si la salida no lo dice). */
  byPayee: { name: string; amount: number; count: number }[];
};

export type MonthlyReport = {
  month: string;
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  income: ByMethod;
  expenses: ByMethod;
  incomeByOrigin: { origin: IncomeOrigin; label: string; amount: number }[];
  expenseGroups: ExpenseGroup[];
  /** Totales por destinatario sin importar la categoría. */
  byPayee: { name: string; amount: number }[];
  expenseLines: ExpenseLine[];
};

export const NO_PAYEE = "Sin especificar";

type MonthPayment = Pick<Payment, "kind" | "amount" | "method"> & { reservation_kind: ReservationKind | null };
type MonthMovement = Pick<
  CashMovement,
  "id" | "date" | "type" | "category" | "counterparty" | "note" | "amount" | "method" | "voided"
>;

export function buildMonthlyReport(input: {
  month: string;
  payments: MonthPayment[];
  movements: MonthMovement[];
}): MonthlyReport {
  const income = emptyByMethod();
  const expenses = emptyByMethod();
  const origin = Object.fromEntries(INCOME_ORIGINS.map((o) => [o, 0])) as Record<IncomeOrigin, number>;

  for (const p of input.payments) {
    if (p.kind === "saldo") continue;
    const amount = Number(p.amount);
    income[p.method] = round2(income[p.method] + amount);
    const o: IncomeOrigin = p.reservation_kind ?? "standard";
    origin[o] = round2(origin[o] + amount);
  }

  const expenseLines: ExpenseLine[] = [];
  for (const m of input.movements) {
    if (m.voided) continue;
    const amount = Number(m.amount);
    if (m.type === "in") {
      income[m.method] = round2(income[m.method] + amount);
      const o: IncomeOrigin = m.category === "accesorio" ? "accesorio" : "otro_ingreso";
      origin[o] = round2(origin[o] + amount);
    } else {
      expenses[m.method] = round2(expenses[m.method] + amount);
      expenseLines.push({ ...m, amount });
    }
  }
  expenseLines.sort((a, b) => a.date.localeCompare(b.date));

  const payeeName = (line: ExpenseLine) => line.counterparty.trim() || NO_PAYEE;
  const groupByPayee = (lines: ExpenseLine[]) => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    for (const line of lines) {
      const name = payeeName(line);
      const key = name.toLowerCase();
      const row = map.get(key) ?? { name, amount: 0, count: 0 };
      row.amount = round2(row.amount + line.amount);
      row.count += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  };

  const expenseGroups: ExpenseGroup[] = CASH_OUT_CATEGORIES.map((category) => {
    const lines = expenseLines.filter((l) => l.category === category);
    return {
      category,
      label: CASH_CATEGORY_LABELS[category],
      total: round2(lines.reduce((s, l) => s + l.amount, 0)),
      byPayee: groupByPayee(lines),
    };
  }).filter((g) => g.total > 0);

  const sum = (b: ByMethod) => round2(Object.values(b).reduce((a, n) => a + n, 0));
  const incomeTotal = sum(income);
  const expenseTotal = sum(expenses);

  return {
    month: input.month,
    incomeTotal,
    expenseTotal,
    balance: round2(incomeTotal - expenseTotal),
    income,
    expenses,
    incomeByOrigin: INCOME_ORIGINS.filter((o) => origin[o] > 0).map((o) => ({
      origin: o,
      label: INCOME_ORIGIN_LABELS[o],
      amount: origin[o],
    })),
    expenseGroups,
    byPayee: groupByPayee(expenseLines).map(({ name, amount }) => ({ name, amount })),
    expenseLines,
  };
}

/** Cobros y movimientos del mes (paginando: un mes puede pasar las 1000 filas). */
export async function loadMonthlyReport(supabase: SupabaseClient, clubId: string, month: string): Promise<MonthlyReport> {
  const { from, to, next } = monthBounds(month);
  type PaymentRow = Pick<Payment, "kind" | "amount" | "method"> & {
    reservations: { kind: ReservationKind } | { kind: ReservationKind }[] | null;
  };

  const [paymentRows, movements] = await Promise.all([
    fetchAll<PaymentRow>(
      (start, end) =>
        supabase
          .from("payments")
          .select("kind, amount, method, reservations(kind)")
          .eq("club_id", clubId)
          .gte("created_at", `${from}T00:00:00${CLUB_OFFSET}`)
          .lt("created_at", `${next}T00:00:00${CLUB_OFFSET}`)
          .order("id")
          .range(start, end) as unknown as PromiseLike<{ data: PaymentRow[] | null; error: { message: string } | null }>
    ),
    fetchAll<MonthMovement>((start, end) =>
      supabase
        .from("cash_movements")
        .select("id, date, type, category, counterparty, note, amount, method, voided")
        .eq("club_id", clubId)
        .gte("date", from)
        .lte("date", to)
        .order("id")
        .range(start, end)
    ),
  ]);

  const payments = paymentRows.map((p) => {
    const r = Array.isArray(p.reservations) ? p.reservations[0] : p.reservations;
    return { kind: p.kind, amount: p.amount, method: p.method, reservation_kind: r?.kind ?? null };
  });
  return buildMonthlyReport({ month, payments, movements });
}

/** Texto del reporte mensual para pegar en WhatsApp. */
export function monthlyReportLines(report: MonthlyReport, formatMoney: (n: number) => string): string[] {
  const lines = [
    `*Reporte mensual · ${monthLabel(report.month)}*`,
    `Ingresos: ${formatMoney(report.incomeTotal)}`,
    `Egresos: ${formatMoney(report.expenseTotal)}`,
    `Balance: ${formatMoney(report.balance)}`,
  ];
  if (report.incomeByOrigin.length) {
    lines.push("", "*Ingresos*", ...report.incomeByOrigin.map((o) => `${o.label}: ${formatMoney(o.amount)}`));
  }
  if (report.expenseGroups.length) {
    lines.push("", "*Egresos*");
    for (const g of report.expenseGroups) {
      lines.push(`${g.label}: ${formatMoney(g.total)}`);
      for (const p of g.byPayee) lines.push(`  · ${p.name}: ${formatMoney(p.amount)}`);
    }
  }
  return lines;
}
