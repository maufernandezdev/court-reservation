import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { amountDue, paidByReservation, type DayPayment } from "@/lib/daily-overview";
import { fetchAll } from "@/lib/reports-queries";
import { VISIBLE_PAYMENT_METHODS, type Reservation } from "@/lib/reservations";

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
};

export type ProfeSettlement = {
  user_id: string;
  name: string;
  color: string | null;
  turns: SettlementTurn[];
  total: number;
  paid: number;
  due: number;
};

type Row = Pick<Reservation, "id" | "date" | "time" | "duration_minutes" | "price" | "payment_status" | "status" | "profe_user_id"> & {
  courts: { name: string } | { name: string }[] | null;
};

/** Turnos de profe activos del período, agrupados por profe, con lo cobrado y lo que falta. */
export async function loadProfeSettlements(
  supabase: SupabaseClient,
  clubId: string,
  profes: { user_id: string; name: string; color: string | null }[],
  from: string,
  to: string
): Promise<ProfeSettlement[]> {
  const rows = await fetchAll<Row>((start, end) =>
    supabase
      .from("reservations")
      .select("id, date, time, duration_minutes, price, payment_status, status, profe_user_id, courts(name)")
      .eq("club_id", clubId)
      .eq("kind", "profe")
      .eq("status", "active")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("time")
      .order("id")
      .range(start, end) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  );

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
    byProfe.set(p.user_id, { ...p, turns: [], total: 0, paid: 0, due: 0 });
  }
  for (const r of rows) {
    if (!r.profe_user_id) continue;
    let entry = byProfe.get(r.profe_user_id);
    if (!entry) {
      // Profe que ya no está en el equipo: sus turnos se liquidan igual.
      entry = { user_id: r.profe_user_id, name: "Profe (fuera del equipo)", color: null, turns: [], total: 0, paid: 0, due: 0 };
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
    });
    entry.total += price;
    entry.paid += r.payment_status === "pagada" ? price : Math.min(price, paid);
    entry.due += due;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byProfe.values()]
    .map((e) => ({ ...e, total: round(e.total), paid: round(e.paid), due: round(e.due) }))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
}

export const settleProfeSchema = z
  .object({
    profeUserId: z.string().uuid("Profe inválido"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
  })
  .refine((v) => v.from <= v.to, { message: "Período inválido", path: ["to"] });
export type SettleProfeInput = z.infer<typeof settleProfeSchema>;
