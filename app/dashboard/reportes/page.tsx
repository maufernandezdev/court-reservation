import Link from "next/link";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { INCOME_ORIGINS, INCOME_ORIGIN_LABELS, dayCloseLines, loadDayClose, type DayClose } from "@/lib/day-close";
import {
  loadMonthlyReport,
  monthLabel,
  monthlyReportLines,
  shiftMonth,
  type MonthlyReport,
} from "@/lib/monthly-report";
import { CASH_CATEGORY_LABELS } from "@/lib/cash";
import { PAYMENT_METHOD_SHORT } from "@/lib/reservations";
import { CLUB_TZ } from "@/lib/club-time";
import { CashDateNav } from "@/components/cash/cash-date-nav";
import { PageHeader } from "@/components/shell/page-header";
import { CopySummary } from "@/components/reports/copy-summary";
import { PrintButton } from "@/components/reports/print-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reportes" };

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
}

function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/**
 * Reportes: el cierre del día (lo mismo que la planilla de papel) y el reporte mensual de ingresos,
 * egresos y balance, con a quién fue cada egreso. Los números siguen el mismo criterio que Caja.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo los administradores pueden ver los reportes del club.</AlertDescription>
      </Alert>
    );
  }

  const raw = await searchParams;
  const clubId = membership.club_id;
  const today = todayKey();
  const currentMonth = today.slice(0, 7);
  const closeDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => value <= today)
    .catch(today)
    .parse(typeof raw.cierre === "string" ? raw.cierre : today);
  const month = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine((value) => value <= currentMonth)
    .catch(currentMonth)
    .parse(typeof raw.mes === "string" ? raw.mes : currentMonth);
  const nowParts = new Date()
    .toLocaleTimeString("en-GB", { timeZone: CLUB_TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  const nowMinutes = closeDate === today ? nowParts[0] * 60 + nowParts[1] : null;

  let loadError = "";
  let close: DayClose | null = null;
  let monthly: MonthlyReport | null = null;
  try {
    [close, monthly] = await Promise.all([
      loadDayClose(supabase, clubId, closeDate, nowMinutes),
      loadMonthlyReport(supabase, clubId, month),
    ]);
  } catch {
    loadError = "No se pudieron cargar los datos del reporte.";
  }

  const closeLabel = closeDate === today ? `Hoy ${shortDate(closeDate)}` : longDate(closeDate);
  const summary = [
    ...(close ? dayCloseLines(close, formatMoney, closeLabel) : []),
    ...(close && monthly ? [""] : []),
    ...(monthly ? monthlyReportLines(monthly, formatMoney) : []),
  ].join("\n");

  // Los links conservan la fecha del cierre elegida.
  const monthHref = (value: string) => {
    const params = new URLSearchParams();
    if (closeDate !== today) params.set("cierre", closeDate);
    if (value !== currentMonth) params.set("mes", value);
    const query = params.toString();
    return query ? `/dashboard/reportes?${query}` : "/dashboard/reportes";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes"
        description="El cierre del día y el reporte mensual de ingresos, egresos y balance."
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {close && <DayCloseSection close={close} label={closeLabel} today={today} />}

      {monthly && (
        <MonthlySection
          report={monthly}
          clubName={membership.club.name}
          prevHref={monthHref(shiftMonth(month, -1))}
          nextHref={month < currentMonth ? monthHref(shiftMonth(month, 1)) : null}
        />
      )}

      <CopySummary text={summary} />
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-t border-muted py-1.5">
      <dt className={cn(muted && "pl-3 text-muted-foreground", strong && "font-semibold")}>{label}</dt>
      <dd className={cn("font-mono", muted && "text-muted-foreground", strong && "font-semibold")}>{formatMoney(value)}</dd>
    </div>
  );
}

/** Reporte mensual: ingresos, egresos (con a quién fueron) y balance. Se puede imprimir o guardar como PDF. */
function MonthlySection({
  report,
  clubName,
  prevHref,
  nextHref,
}: {
  report: MonthlyReport;
  clubName: string;
  prevHref: string;
  nextHref: string | null;
}) {
  const cards = [
    { title: "Ingresos", value: report.incomeTotal, note: `MP ${formatMoney(report.income.mercado_pago)} · efectivo ${formatMoney(report.income.efectivo)}` },
    { title: "Egresos", value: report.expenseTotal, note: `MP ${formatMoney(report.expenses.mercado_pago)} · efectivo ${formatMoney(report.expenses.efectivo)}` },
  ];
  return (
    <section aria-labelledby="mensual" className="print-area flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="mensual" className="text-lg font-bold">
          Reporte mensual <span className="font-normal text-muted-foreground">· {monthLabel(report.month)}</span>
          <span className="hidden font-normal text-muted-foreground print:inline"> · {clubName}</span>
        </h2>
        <div className="flex items-center gap-1.5 print:hidden">
          <Button asChild variant="outline" size="icon" aria-label="Mes anterior">
            <Link href={prevHref}>
              <ChevronLeft />
            </Link>
          </Button>
          {nextHref ? (
            <Button asChild variant="outline" size="icon" aria-label="Mes siguiente">
              <Link href={nextHref}>
                <ChevronRight />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" aria-label="Mes siguiente" disabled>
              <ChevronRight />
            </Button>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
        {cards.map((card) => (
          <div key={card.title} className="flex flex-col gap-1 rounded-xl border p-4">
            <h3 className="text-sm text-muted-foreground">{card.title}</h3>
            <strong className="font-mono text-2xl font-bold">{formatMoney(card.value)}</strong>
            <span className="text-xs text-muted-foreground">{card.note}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1 rounded-xl bg-ball p-4 text-ball-foreground">
          <h3 className="text-sm font-medium">Balance</h3>
          <strong className="font-mono text-2xl font-bold">{formatMoney(report.balance)}</strong>
          <span className="text-xs">Ingresos − egresos</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <dl className="flex flex-col text-[15px]">
          <dt className="pb-1 text-sm font-semibold">Ingresos por origen</dt>
          {report.incomeByOrigin.length === 0 ? (
            <dd className="text-sm text-muted-foreground">Sin ingresos.</dd>
          ) : (
            <>
              {report.incomeByOrigin.map((o) => (
                <Row key={o.origin} label={o.label} value={o.amount} />
              ))}
              <Row label="Total" value={report.incomeTotal} strong />
            </>
          )}
        </dl>
        <dl className="flex flex-col text-[15px]">
          <dt className="pb-1 text-sm font-semibold">Egresos: a dónde fueron</dt>
          {report.expenseGroups.length === 0 ? (
            <dd className="text-sm text-muted-foreground">Sin egresos.</dd>
          ) : (
            <>
              {report.expenseGroups.map((g) => (
                <div key={g.category} className="flex flex-col">
                  <Row label={g.label} value={g.total} strong />
                  {g.byPayee.map((p) => (
                    <Row key={p.name} label={`${p.name}${p.count > 1 ? ` (${p.count})` : ""}`} value={p.amount} muted />
                  ))}
                </div>
              ))}
              <Row label="Total" value={report.expenseTotal} strong />
            </>
          )}
        </dl>
      </div>

      {report.expenseLines.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Detalle de egresos</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="text-[13px] text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-2 font-medium">Categoría</th>
                  <th scope="col" className="px-3 py-2 font-medium">A quién</th>
                  <th scope="col" className="px-3 py-2 font-medium">Nota</th>
                  <th scope="col" className="px-3 py-2 font-medium">Medio</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {report.expenseLines.map((line) => (
                  <tr key={line.id} className="border-t border-muted">
                    <td className="py-2 pr-3 font-mono">{shortDate(line.date)}</td>
                    <td className="px-3 py-2">{CASH_CATEGORY_LABELS[line.category]}</td>
                    <td className="px-3 py-2">{line.counterparty || <span className="text-muted-foreground">Sin especificar</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.note}</td>
                    <td className="px-3 py-2">{PAYMENT_METHOD_SHORT[line.method]}</td>
                    <td className="py-2 pl-3 text-right font-mono">{formatMoney(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/** Cierre del día: ingresos, egresos, Mercado Pago y efectivo en caja, con el detalle por origen y categoría. */
function DayCloseSection({ close, label, today }: { close: DayClose; label: string; today: string }) {
  const origins = INCOME_ORIGINS.filter((o) => close.incomeByOrigin[o] > 0);
  const cards = [
    { title: "Ingresos", value: close.cash.incomeTotal, note: `MP ${formatMoney(close.cash.income.mercado_pago)} · efectivo ${formatMoney(close.cash.income.efectivo)}` },
    { title: "Egresos", value: close.cash.expenseTotal, note: `MP ${formatMoney(close.cash.expenses.mercado_pago)} · efectivo ${formatMoney(close.cash.expenses.efectivo)}` },
    { title: "Mercado Pago", value: close.cash.income.mercado_pago, note: `Neto ${formatMoney(close.cash.mercadoPagoNet)}` },
  ];
  return (
    <section aria-labelledby="cierre" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cierre" className="text-lg font-bold">
          Cierre del día <span className="font-normal text-muted-foreground">· {label}</span>
        </h2>
        <CashDateNav date={close.date} today={today} param="cierre" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-ball p-4 text-ball-foreground">
          <h3 className="text-sm font-medium">Efectivo en caja</h3>
          <strong className="font-mono text-2xl font-bold">{formatMoney(close.cash.cashOnHand)}</strong>
          <span className="text-xs">Cambio {formatMoney(close.cash.opening)}</span>
        </div>
        {cards.map((card) => (
          <div key={card.title} className="flex flex-col gap-1 rounded-xl border p-4">
            <h3 className="text-sm text-muted-foreground">{card.title}</h3>
            <strong className="font-mono text-2xl font-bold">{formatMoney(card.value)}</strong>
            <span className="text-xs text-muted-foreground">{card.note}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <dl className="flex flex-col text-[15px]">
          <dt className="pb-1 text-sm font-semibold">Ingresos por origen</dt>
          {origins.length === 0 ? (
            <dd className="text-sm text-muted-foreground">Sin ingresos.</dd>
          ) : (
            origins.map((o) => (
              <div key={o} className="flex justify-between border-t border-muted py-1.5">
                <dt>{INCOME_ORIGIN_LABELS[o]}</dt>
                <dd className="font-mono">{formatMoney(close.incomeByOrigin[o])}</dd>
              </div>
            ))
          )}
        </dl>
        <dl className="flex flex-col text-[15px]">
          <dt className="pb-1 text-sm font-semibold">Egresos por categoría</dt>
          {close.expensesByCategory.length === 0 ? (
            <dd className="text-sm text-muted-foreground">Sin egresos.</dd>
          ) : (
            close.expensesByCategory.map((e) => (
              <div key={e.category} className="flex justify-between border-t border-muted py-1.5">
                <dt>{e.label}</dt>
                <dd className="font-mono">{formatMoney(e.amount)}</dd>
              </div>
            ))
          )}
        </dl>
        <dl className="flex flex-col text-[15px]">
          <dt className="pb-1 text-sm font-semibold">Turnos</dt>
          <div className="flex justify-between border-t border-muted py-1.5">
            <dt>Jugados</dt>
            <dd className="font-mono">{close.playedCount}</dd>
          </div>
          <div className="flex justify-between border-t border-muted py-1.5">
            <dt>Cancelados</dt>
            <dd className="font-mono">{close.cancelledCount}</dd>
          </div>
          <div className="flex justify-between border-t border-muted py-1.5">
            <dt>Falta cobrar</dt>
            <dd className="font-mono">
              {formatMoney(close.dueAmount)}
              {close.dueCount > 0 ? ` (${close.dueCount})` : ""}
            </dd>
          </div>
          {close.openPerPersonCount > 0 && (
            <div className="flex justify-between border-t border-muted py-1.5">
              <dt>Por persona sin cerrar</dt>
              <dd className="font-mono">{close.openPerPersonCount}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
