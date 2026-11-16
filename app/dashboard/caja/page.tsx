import { ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { CLUB_TZ, clubTodayKey } from "@/lib/club-time";
import { queryProfes } from "@/lib/club-data";
import { roleAtLeast } from "@/lib/roles";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SHORT,
  PAYMENT_METHODS,
  type Payment,
} from "@/lib/reservations";
import {
  CASH_CATEGORY_LABELS,
  dayRange,
  summarizeCashDay,
  type CashMovement,
} from "@/lib/cash";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { CashDateNav } from "@/components/cash/cash-date-nav";
import { CashExpenseDialog, CashSaleDialog, type ProductSuggestion } from "@/components/cash/cash-movement-dialogs";
import { CashOpeningForm, VoidMovementButton } from "@/components/cash/cash-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Caja" };

const KIND_LABELS: Record<Payment["kind"], string> = {
  seña: "Seña",
  total: "Cobro",
  saldo: "Saldo a favor aplicado",
};

function dayTitle(key: string, today: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return key === today ? `Hoy · ${label}` : label;
}

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: CLUB_TZ,
  });
}

type ReservationRow = {
  id: string;
  customer_name: string;
  date: string;
  time: string;
  courts: { name: string } | null;
};

/** Fila de la lista: un cobro de turno o un movimiento cargado en la caja. */
type Row =
  | { source: "payment"; at: string; payment: Payment }
  | { source: "movement"; at: string; movement: CashMovement };

/**
 * Caja del día: la planilla de entradas y salidas.
 * Entra plata: cobros de turnos (señas y pagos, aunque después pasen a saldo a favor) y ventas.
 * No entra plata: el saldo a favor aplicado (ya estaba en la caja).
 * Efectivo en caja = cambio inicial + entradas en efectivo − salidas en efectivo.
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership } = await getSessionContext();

  if (!membership || !roleAtLeast(membership.role, "operador")) {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo el personal del club puede ver la caja.</AlertDescription>
      </Alert>
    );
  }

  const isAdmin = membership.role === "admin";
  const today = clubTodayKey();
  const raw = await searchParams;
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => value <= today)
    .catch(today)
    .parse(typeof raw.fecha === "string" ? raw.fecha : today);

  const clubId = membership.club_id;
  const range = dayRange(date);
  const [
    { data: paymentsData, error },
    { data: movementsData, error: movementsError },
    { data: openingData },
    { data: membersData },
    { data: soldData },
    profes,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("club_id", clubId)
      .gte("created_at", range.from)
      .lt("created_at", range.to)
      .order("created_at", { ascending: false }),
    supabase
      .from("cash_movements")
      .select("*")
      .eq("club_id", clubId)
      .eq("date", date)
      .order("created_at", { ascending: false }),
    supabase.from("cash_openings").select("amount").eq("club_id", clubId).eq("date", date).maybeSingle(),
    supabase.from("memberships").select("user_id, full_name, email").eq("club_id", clubId),
    // Lo ya vendido, para sugerir producto y precio en "Registrar venta".
    supabase
      .from("cash_movements")
      .select("concept, amount, quantity")
      .eq("club_id", clubId)
      .eq("category", "accesorio")
      .eq("voided", false)
      .order("created_at", { ascending: false })
      .limit(300),
    isAdmin ? queryProfes(supabase, clubId) : Promise.resolve([]),
  ]);

  const payments = (paymentsData ?? []) as Payment[];
  const movements = (movementsData ?? []) as CashMovement[];
  const opening = Number(openingData?.amount ?? 0);

  const suggestions: ProductSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of (soldData ?? []) as { concept: string; amount: number; quantity: number | null }[]) {
    const key = row.concept.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      concept: row.concept.trim(),
      unit_price: Math.round((Number(row.amount) / (row.quantity || 1)) * 100) / 100,
    });
  }

  const reservationIds = [...new Set(payments.map((p) => p.reservation_id))];
  const { data: reservationsData } = reservationIds.length
    ? await supabase
        .from("reservations")
        .select("id, customer_name, date, time, court_id, courts(name)")
        .eq("club_id", clubId)
        .in("id", reservationIds)
    : { data: [] };
  const reservationById = new Map(
    ((reservationsData ?? []) as unknown as ReservationRow[]).map((r) => [r.id, r])
  );
  const memberName = new Map(
    ((membersData ?? []) as { user_id: string; full_name: string; email: string }[]).map((m) => [
      m.user_id,
      m.full_name || m.email,
    ])
  );

  const summary = summarizeCashDay({ opening, payments, movements });
  const creditApplied = payments
    .filter((p) => p.kind === "saldo")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const incomeRows: Row[] = [
    ...payments.map((payment): Row => ({ source: "payment", at: payment.created_at, payment })),
    ...movements
      .filter((m) => m.type === "in")
      .map((movement): Row => ({ source: "movement", at: movement.created_at, movement })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const expenses = movements.filter((m) => m.type === "out");
  const cashExpenses = expenses.filter((m) => m.method !== "mercado_pago");
  const mpExpenses = expenses.filter((m) => m.method === "mercado_pago");
  // Medios viejos (transferencia, otro): se muestran solo si ese día hubo alguno.
  const legacyMethods = PAYMENT_METHODS.filter(
    (m) => m !== "efectivo" && m !== "mercado_pago" && (summary.income[m] > 0 || summary.expenses[m] > 0)
  );

  const movementLine = (m: CashMovement) => {
    const who = m.created_by ? memberName.get(m.created_by) : undefined;
    const title =
      m.type === "in"
        ? `${m.concept || CASH_CATEGORY_LABELS[m.category]}${m.quantity && m.quantity > 1 ? ` ×${m.quantity}` : ""}`
        : `${CASH_CATEGORY_LABELS[m.category]}${m.counterparty ? ` · ${m.counterparty}` : ""}`;
    const detail = [
      m.type === "in" ? CASH_CATEGORY_LABELS[m.category] : null,
      m.note || null,
      who ? `cargó ${who}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { title, detail };
  };

  const renderMovement = (m: CashMovement) => {
    const { title, detail } = movementLine(m);
    return (
      <li
        key={m.id}
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-muted px-5 py-3.5 first:border-t-0",
          m.voided && "text-muted-foreground"
        )}
      >
        <time dateTime={m.created_at} className="w-12 font-mono text-sm text-muted-foreground">
          {clock(m.created_at)}
        </time>
        <span className="flex min-w-0 flex-[1_1_220px] flex-col">
          <strong className={cn("truncate text-[15px]", m.voided && "line-through")}>{title}</strong>
          {detail && <span className="truncate text-[13px] text-muted-foreground">{detail}</span>}
        </span>
        {m.voided ? (
          <Badge variant="outline">Anulado</Badge>
        ) : (
          <Badge variant="outline">{PAYMENT_METHOD_SHORT[m.method]}</Badge>
        )}
        <strong className={cn("ml-auto font-mono text-base", m.voided && "line-through")}>
          {m.type === "out" ? "−" : ""}
          {formatMoney(Number(m.amount))}
        </strong>
        {isAdmin && !m.voided && <VoidMovementButton id={m.id} label={title} />}
      </li>
    );
  };

  const expenseSection = (id: string, title: string, rows: CashMovement[], total: number) => (
    <section aria-labelledby={id} className="overflow-hidden rounded-2xl border bg-card">
      <h2 id={id} className="flex items-center justify-between border-b px-5 py-3.5 text-base font-bold">
        {title}
        <span className="font-mono text-sm">−{formatMoney(total)}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sin salidas.</p>
      ) : (
        <ol>{rows.map(renderMovement)}</ol>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caja"
        eyebrow={dayTitle(date, today)}
        description="Entradas y salidas del día: cobros de turnos, ventas, gastos y liquidaciones."
        actions={<CashDateNav date={date} today={today} />}
      />

      {(error || movementsError) && (
        <Alert variant="destructive">
          <AlertDescription>No se pudo cargar la caja.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <CashSaleDialog date={date} suggestions={suggestions} />
        {isAdmin && <CashExpenseDialog date={date} profeNames={profes.map((p) => p.name)} />}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3.5">
        <section className="flex flex-col gap-1 rounded-2xl bg-ball p-5 text-ball-foreground">
          <h2 className="text-sm font-medium">Efectivo en caja</h2>
          <strong className="font-display text-[34px] leading-tight font-extrabold font-stretch-[125%]">
            {formatMoney(summary.cashOnHand)}
          </strong>
          <span className="text-sm">
            Cambio {formatMoney(summary.opening)} + entradas {formatMoney(summary.income.efectivo)} − salidas{" "}
            {formatMoney(summary.expenses.efectivo)}
          </span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Efectivo</h2>
          <strong className="font-mono text-2xl font-bold">{formatMoney(summary.income.efectivo)}</strong>
          <span className="text-sm text-muted-foreground">
            Salidas {formatMoney(summary.expenses.efectivo)}
          </span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Mercado Pago</h2>
          <strong className="font-mono text-2xl font-bold">{formatMoney(summary.income.mercado_pago)}</strong>
          <span className="text-sm text-muted-foreground">
            Salidas {formatMoney(summary.expenses.mercado_pago)}
          </span>
        </section>
        {legacyMethods.map((method) => (
          <section key={method} className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
            <h2 className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[method]}</h2>
            <strong className="font-mono text-2xl font-bold">{formatMoney(summary.income[method])}</strong>
            {summary.expenses[method] > 0 && (
              <span className="text-sm text-muted-foreground">Salidas {formatMoney(summary.expenses[method])}</span>
            )}
          </section>
        ))}
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Cambio inicial</h2>
          <CashOpeningForm date={date} amount={opening} canEdit={isAdmin} />
        </section>
      </div>

      <p className="text-sm text-muted-foreground">
        Ingresos del día <strong className="font-mono text-foreground">{formatMoney(summary.incomeTotal)}</strong> ·
        egresos <strong className="font-mono text-foreground">{formatMoney(summary.expenseTotal)}</strong>
      </p>

      {creditApplied > 0 && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Además se aplicaron <strong className="text-foreground">{formatMoney(creditApplied)}</strong> de
          saldo a favor (plata que ya estaba en la caja, no suma al total).
        </p>
      )}

      <section aria-labelledby="entradas" className="overflow-hidden rounded-2xl border bg-card">
        <h2 id="entradas" className="flex items-center justify-between border-b px-5 py-3.5 text-base font-bold">
          Entradas
          <span className="font-mono text-sm">{formatMoney(summary.incomeTotal)}</span>
        </h2>
        {incomeRows.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">No hubo cobros ni ventas este día.</p>
        ) : (
          <ol>
            {incomeRows.map((row) => {
              if (row.source === "movement") return renderMovement(row.movement);
              const payment = row.payment;
              const reservation = reservationById.get(payment.reservation_id);
              const who = payment.created_by ? memberName.get(payment.created_by) : undefined;
              return (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-muted px-5 py-3.5 first:border-t-0"
                >
                  <time dateTime={payment.created_at} className="w-12 font-mono text-sm text-muted-foreground">
                    {clock(payment.created_at)}
                  </time>
                  <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                    <strong className="truncate text-[15px]">
                      {KIND_LABELS[payment.kind]}
                      {reservation ? ` · ${reservation.customer_name}` : ""}
                    </strong>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {reservation
                        ? `${reservation.courts?.name ?? "Cancha"} · turno del ${shortDate(reservation.date)} ${reservation.time}`
                        : "Turno"}
                      {who ? ` · cobró ${who}` : ""}
                    </span>
                  </span>
                  {payment.kind === "saldo" ? (
                    <Badge variant="outline">No suma</Badge>
                  ) : (
                    <Badge variant="outline">{PAYMENT_METHOD_SHORT[payment.method]}</Badge>
                  )}
                  {payment.released && (
                    <Badge variant="outline" className="border-line/40 text-line">
                      Pasó a saldo a favor
                    </Badge>
                  )}
                  <strong className="ml-auto font-mono text-base">{formatMoney(Number(payment.amount))}</strong>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {expenseSection(
          "gastos-efectivo",
          "Gastos y liquidaciones",
          cashExpenses,
          cashExpenses.filter((m) => !m.voided).reduce((s, m) => s + Number(m.amount), 0)
        )}
        {expenseSection("gastos-mp", "Gastos MP", mpExpenses, summary.expenses.mercado_pago)}
      </div>
    </div>
  );
}
