import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { amountDue, paidByReservation, type DayPayment } from "@/lib/daily-overview";
import { fetchAll } from "@/lib/reports-queries";
import { VISIBLE_PAYMENT_METHODS, type Reservation } from "@/lib/reservations";
import { isNight } from "@/lib/pricing";

/**
 * Liquidación de profes: el profe le paga al club los turnos de profe que usó en un período
 * (por defecto, la semana de lunes a domingo). Se cobra el saldo de cada turno de una vez.
 */

const DAY = 24 * 60 * 60 * 1000;

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysKey(key: string, days: number): string {
  return new Date(parseKey(key).getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha. */
export function weekStart(key: string): string {
  const dow = parseKey(key).getUTCDay(); // 0 = domingo
  return addDaysKey(key, -((dow + 6) % 7));
}

export function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export type SettlementTurn = Pick<Reservation, "id" | "date" | "time" | "duration_minutes" | "price" | "payment_status"> & {
  courtName: string;
  paid: number;
  due: number;
  /** Fecha de un turno fijo semanal. */
  fixed: boolean;
  night: boolean;
};

/** Resumen de la liquidación: horas, días, canchas y franjas usadas. */
export type SettlementSummary = {
  minutes: number;
  dayMinutes: number;
  nightMinutes: number;
  fixedCount: number;
  byCourt: { name: string; turns: number; minutes: number; amount: number }[];
  byWeekday: { weekday: number; turns: number; minutes: number }[];
};

export type ProfeSettlement = {
  user_id: string;
  name: string;
  color: string | null;
  turns: SettlementTurn[];
  total: number;
  paid: number;
  due: number;
  summary: SettlementSummary;
};

const EMPTY_SUMMARY = (): SettlementSummary => ({ minutes: 0, dayMinutes: 0, nightMinutes: 0, fixedCount: 0, byCourt: [], byWeekday: [] });

function summarize(turns: SettlementTurn[]): SettlementSummary {
  const summary = EMPTY_SUMMARY();
  const courts = new Map<string, { name: string; turns: number; minutes: number; amount: number }>();
  const days = new Map<number, { weekday: number; turns: number; minutes: number }>();
  for (const t of turns) {
    summary.minutes += t.duration_minutes;
    if (t.night) summary.nightMinutes += t.duration_minutes;
    else summary.dayMinutes += t.duration_minutes;
    if (t.fixed) summary.fixedCount += 1;
    const c = courts.get(t.courtName) ?? { name: t.courtName, turns: 0, minutes: 0, amount: 0 };
    c.turns += 1;
    c.minutes += t.duration_minutes;
    c.amount = Math.round((c.amount + t.price) * 100) / 100;
    courts.set(t.courtName, c);
    const weekday = parseKey(t.date).getUTCDay();
    const d = days.get(weekday) ?? { weekday, turns: 0, minutes: 0 };
    d.turns += 1;
    d.minutes += t.duration_minutes;
    days.set(weekday, d);
  }
  summary.byCourt = [...courts.values()].sort((a, b) => b.minutes - a.minutes);
  // Lunes primero.
  summary.byWeekday = [...days.values()].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  return summary;
}

/** "1 h 30 min". */
export function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

type Row = Pick<Reservation, "id" | "date" | "time" | "duration_minutes" | "price" | "payment_status" | "status" | "profe_user_id" | "series_id"> & {
  courts: { name: string } | { name: string }[] | null;
};

/** Turnos de profe activos del período, agrupados por profe, con lo cobrado y lo que falta. */
export async function loadProfeSettlements(
  supabase: SupabaseClient,
  clubId: string,
  profes: { user_id: string; name: string; color: string | null }[],
  from: string,
  to: string,
  nightStartsAt: string,
  /** Solo los turnos de este profe (vista del propio profe). */
  onlyProfeId?: string,
  /** Solo lo que falta liquidar: turnos sin pagar que ya terminaron (ver `isFinished`). */
  pending?: { today: string; nowMinutes: number }
): Promise<ProfeSettlement[]> {
  const rows = await fetchAll<Row>((start, end) => {
    const query = supabase
      .from("reservations")
      .select("id, date, time, duration_minutes, price, payment_status, status, profe_user_id, series_id, courts(name)")
      .eq("club_id", clubId)
      .eq("kind", "profe")
      .eq("status", "active")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("time")
      .order("id");
    const scoped = pending ? query.neq("payment_status", "pagada") : query;
    return (onlyProfeId ? scoped.eq("profe_user_id", onlyProfeId) : scoped).range(start, end) as unknown as PromiseLike<{
      data: Row[] | null;
      error: { message: string } | null;
    }>;
  });

  const ids = rows.map((r) => r.id);
  const payments = ids.length
    ? await fetchAll<DayPayment>((start, end) =>
        supabase
          .from("payments")
          .select("reservation_id, amount, released")
          .eq("club_id", clubId)
          .in("reservation_id", ids)
          .order("id")
          .range(start, end)
      )
    : [];
  const paidMap = paidByReservation(payments);

  const byProfe = new Map<string, ProfeSettlement>();
  for (const p of profes) {
    byProfe.set(p.user_id, { ...p, turns: [], total: 0, paid: 0, due: 0, summary: EMPTY_SUMMARY() });
  }
  for (const r of rows) {
    if (!r.profe_user_id) continue;
    if (pending && !isFinished(r.date, r.time, r.duration_minutes, pending.today, pending.nowMinutes)) continue;
    let entry = byProfe.get(r.profe_user_id);
    if (!entry) {
      // Profe que ya no está en el equipo: sus turnos se liquidan igual.
      entry = { user_id: r.profe_user_id, name: "Profe (fuera del equipo)", color: null, turns: [], total: 0, paid: 0, due: 0, summary: EMPTY_SUMMARY() };
      byProfe.set(r.profe_user_id, entry);
    }
    const court = Array.isArray(r.courts) ? r.courts[0] : r.courts;
    const paid = paidMap.get(r.id) ?? 0;
    const due = amountDue(r as unknown as Reservation, paid);
    const price = Number(r.price) || 0;
    entry.turns.push({
      id: r.id,
      date: r.date,
      time: r.time,
      duration_minutes: r.duration_minutes,
      price,
      payment_status: r.payment_status,
      courtName: court?.name ?? "Cancha",
      paid,
      due,
      fixed: !!r.series_id,
      night: isNight(r.time, nightStartsAt),
    });
    entry.total += price;
    entry.paid += r.payment_status === "pagada" ? price : Math.min(price, paid);
    entry.due += due;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byProfe.values()]
    .map((e) => ({ ...e, total: round(e.total), paid: round(e.paid), due: round(e.due), summary: summarize(e.turns) }))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
}

/** Minutos desde la medianoche de "HH:MM". */
function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** El turno ya terminó (mismo criterio que `settle_profe_pending` en la base). */
export function isFinished(date: string, time: string, durationMinutes: number, today: string, nowMinutes: number): boolean {
  if (date < today) return true;
  if (date > today) return false;
  return hhmmToMinutes(time) + durationMinutes <= nowMinutes;
}

/** Fecha mínima para "todo lo pendiente" cuando el club no fijó "Liquidar desde". */
export const SETTLE_FROM_FALLBACK = "2000-01-01";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

/** Cobrar todo lo pendiente del profe hasta una fecha (nunca futura: lo valida también la base). */
export const settlePendingSchema = z.object({
  profeUserId: z.string().uuid("Profe inválido"),
  until: dateKey,
  method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
});
export type SettlePendingInput = z.infer<typeof settlePendingSchema>;

/**
 * Cobro a cuenta del profe: el total que debe (`amount` vacío) u otro monto menor, que se descuenta de su
 * cuenta imputándolo a los turnos más viejos primero (lo valida también la base).
 */
export const settleAmountSchema = z.object({
  profeUserId: z.string().uuid("Profe inválido"),
  amount: z.number().positive("El monto tiene que ser mayor a cero").nullable(),
  method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
});
export type SettleAmountInput = z.infer<typeof settleAmountSchema>;


/** Liquidación registrada (historial). */
export type ProfeSettlementRecord = {
  id: string;
  profe_user_id: string;
  period_from: string | null;
  period_to: string;
  method: string;
  amount: number;
  turns_count: number;
  created_at: string;
  voided_at: string | null;
};


/** Texto de la liquidación para mandarle al profe por WhatsApp. */
export function settlementText(
  profe: ProfeSettlement,
  clubName: string,
  periodLabel: string,
  formatMoney: (n: number) => string
): string {
  const s = profe.summary;
  const lines = [
    `*Liquidación de canchas · ${clubName}*`,
    `${profe.name} · ${periodLabel}`,
    "",
    `Turnos: ${profe.turns.length}${s.fixedCount ? ` (${s.fixedCount} fijos)` : ""}`,
    `Horas: ${hoursText(s.minutes)}${s.nightMinutes ? ` (día ${hoursText(s.dayMinutes)} · noche ${hoursText(s.nightMinutes)})` : ""}`,
    `Total: ${formatMoney(profe.total)}`,
  ];
  if (profe.paid > 0) lines.push(`Ya pagado: ${formatMoney(profe.paid)}`);
  lines.push(`*A pagar: ${formatMoney(profe.due)}*`, "", "*Detalle*");
  for (const t of profe.turns) {
    const day = WEEKDAY_NAMES[parseKey(t.date).getUTCDay()].slice(0, 3);
    lines.push(
      `${day} ${shortDay(t.date)} ${t.time} · ${t.courtName} · ${hoursText(t.duration_minutes)}${t.fixed ? " · fijo" : ""} · ${formatMoney(t.price)}${t.due === 0 ? " (pagado)" : ""}`
    );
  }
  return lines.join("\n");
}
