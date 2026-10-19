import { CircleCheck, ShieldAlert, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { DEFAULT_CLUB_HOURS, normalizeTime } from "@/lib/availability";
import { COURT_TYPE_LABELS, type Court, type CourtType } from "@/lib/courts";
import { DEFAULT_NIGHT_STARTS_AT, formatMoney } from "@/lib/pricing";
import {
  REPORT_PERIODS,
  REPORT_PERIOD_LABELS,
  buildReport,
  buildWhatsappSummary,
  hoursLabel,
  periodRange,
  type ReportPeriod,
} from "@/lib/reports";
import { loadOverdue, loadPeriodData } from "@/lib/reports-queries";
import { PageHeader } from "@/components/shell/page-header";
import { PeriodTabs } from "@/components/reports/period-tabs";
import { CopySummary } from "@/components/reports/copy-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Reportes" };

const CLUB_TZ = "America/Argentina/Buenos_Aires";

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Reportes: cómo rindieron las canchas del club en un período (hoy, ayer, 7 días o el mes), con datos
 * reales de turnos y cobros. Los ingresos siguen el mismo criterio que Caja.
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
  const period: ReportPeriod = z
    .enum(REPORT_PERIODS)
    .catch("hoy")
    .parse(typeof raw.periodo === "string" ? raw.periodo : "hoy");

  const clubId = membership.club_id;
  const today = todayKey();
  const range = periodRange(period, today);

  const [courtsRes, settingsRes, pricesRes] = await Promise.all([
    supabase.from("courts").select("*").eq("club_id", clubId).eq("active", true).order("created_at"),
    supabase.from("settings").select("night_starts_at, open_time, close_time").eq("club_id", clubId).maybeSingle(),
    supabase.from("sport_prices").select("sport, public_price_per_hour").eq("club_id", clubId),
  ]);

  let loadError = courtsRes.error ? "No se pudieron cargar las canchas." : "";
  const courts = (courtsRes.data ?? []) as Court[];
  const settings = settingsRes.data;
  const hours = {
    open_time: normalizeTime(settings?.open_time ?? DEFAULT_CLUB_HOURS.open_time),
    close_time: normalizeTime(settings?.close_time ?? DEFAULT_CLUB_HOURS.close_time),
  };
  const nightStartsAt = normalizeTime(settings?.night_starts_at ?? DEFAULT_NIGHT_STARTS_AT);

  let data: Awaited<ReturnType<typeof loadPeriodData>> = { reservations: [], payments: [], income: [] };
  let overdue = { count: 0, amount: 0 };
  try {
    [data, overdue] = await Promise.all([loadPeriodData(supabase, clubId, range), loadOverdue(supabase, clubId, today)]);
  } catch {
    loadError = "No se pudieron cargar los datos del período.";
  }

  const report = buildReport({ courts, ...data, hours, nightStartsAt, range, today });
  const periodTitle = period === "hoy" || period === "ayer" ? longDate(range.from) : `${shortDate(range.from)} al ${shortDate(range.to)}`;
  const summary = buildWhatsappSummary({
    clubName: membership.club.name,
    periodLabel: REPORT_PERIOD_LABELS[period],
    report,
    formatMoney,
  });

  // Para revisar: lo que conviene mirar de las canchas.
  const pricedSports = new Set(
    (pricesRes.data ?? []).filter((p) => Number(p.public_price_per_hour) > 0).map((p) => p.sport as CourtType)
  );
  const sportsWithoutPrice = [...new Set(courts.map((c) => c.type))].filter((sport) => !pricedSports.has(sport));
  const idleCourts = report.courts.filter((row) => row.bookings === 0);
  const reviewItems: string[] = [];
  if (overdue.count > 0) {
    reviewItems.push(
      `${plural(overdue.count, "turno", "turnos")} de los últimos 30 días con saldo sin cobrar: ${formatMoney(overdue.amount)}.`
    );
  }
  if (report.lateCancelledCount > 0) {
    reviewItems.push(`${plural(report.lateCancelledCount, "cancelación tardía", "cancelaciones tardías")} en el período.`);
  }
  if (sportsWithoutPrice.length > 0) {
    reviewItems.push(
      `Sin precio cargado: ${sportsWithoutPrice.map((s) => COURT_TYPE_LABELS[s]).join(", ")} (Canchas → Precios).`
    );
  }
  if (idleCourts.length > 0 && courts.length > 0) {
    reviewItems.push(`Sin turnos en el período: ${idleCourts.map((row) => row.court.name).join(", ")}.`);
  }

  const maxHour = report.byHour[0]?.bookings ?? 0;
  const topHours = report.byHour.slice(0, 6);
  const kindRows = [
    { label: "Estándar", value: report.byKind.standard },
    { label: "Profe", value: report.byKind.profe },
    { label: "Torneo", value: report.byKind.torneo },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes"
        eyebrow={`${REPORT_PERIOD_LABELS[period]} · ${periodTitle}`}
        description="Cómo rindieron tus canchas en el período."
        actions={<PeriodTabs current={period} />}
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
        <section className="flex flex-col gap-1 rounded-2xl bg-ball p-5 text-ball-foreground">
          <h2 className="text-sm font-medium">Ingresos cobrados</h2>
          <strong className="font-display text-[34px] leading-tight font-extrabold font-stretch-[125%]">
            {formatMoney(report.income)}
          </strong>
          <span className="text-sm">{plural(report.incomeCount, "cobro", "cobros")}</span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Turnos</h2>
          <strong className="font-mono text-2xl font-bold">{report.activeCount}</strong>
          <span className="text-sm text-muted-foreground">
            {report.cancelledCount > 0 ? plural(report.cancelledCount, "cancelado", "cancelados") : "Sin cancelaciones"}
          </span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Ocupación</h2>
          <strong className="font-mono text-2xl font-bold">{report.occupancyPercent}%</strong>
          <span className="text-sm text-muted-foreground">{hoursLabel(report.bookedMinutes)} reservadas</span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Falta cobrar</h2>
          <strong className="font-mono text-2xl font-bold">{formatMoney(report.due)}</strong>
          <span className="text-sm text-muted-foreground">
            {report.dueCount > 0 ? plural(report.dueCount, "turno", "turnos") : "Todo cobrado"}
          </span>
        </section>
      </div>

      <section aria-labelledby="por-cancha" className="overflow-hidden rounded-2xl border bg-card">
        <h2 id="por-cancha" className="border-b px-5 py-3.5 text-base font-bold">
          Por cancha
        </h2>
        {report.courts.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Todavía no hay canchas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[15px]">
              <thead className="text-[13px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Cancha</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Turnos</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Horas</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Ocupación</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {report.courts.map((row) => (
                  <tr key={row.court.id} className="border-t border-muted">
                    <th scope="row" className="px-5 py-3 font-semibold">
                      {row.court.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {COURT_TYPE_LABELS[row.court.type]}
                      </span>
                    </th>
                    <td className="px-3 py-3 text-right font-mono">{row.bookings}</td>
                    <td className="px-3 py-3 text-right font-mono">{hoursLabel(row.bookedMinutes)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, row.occupancyPercent)}%` }} />
                        </div>
                        <span className="w-10 font-mono text-sm">{row.occupancyPercent}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{formatMoney(row.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="horarios" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 id="horarios" className="text-base font-bold">
            Horarios más pedidos
          </h2>
          {topHours.length === 0 ? (
            <p className="text-muted-foreground">No hay turnos en el período.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {topHours.map(({ hour, bookings }) => (
                <li key={hour} className="flex items-center gap-3">
                  <span className="w-12 font-mono text-sm">{String(hour).padStart(2, "0")}:00</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(bookings / maxHour) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-sm">{bookings}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="tipos" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 id="tipos" className="text-base font-bold">
            Tipos de turno
          </h2>
          <dl className="flex flex-col text-[15px]">
            {kindRows.map(({ label, value }) => (
              <div key={label} className="flex justify-between border-t border-muted py-2 first:border-t-0">
                <dt>{label}</dt>
                <dd className="font-mono font-semibold">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-muted py-2">
              <dt className="text-muted-foreground">Fijos (incluidos arriba)</dt>
              <dd className="font-mono">{report.byKind.fixed}</dd>
            </div>
            <div className="flex justify-between border-t border-muted py-2">
              <dt className="text-muted-foreground">De noche (desde las {nightStartsAt})</dt>
              <dd className="font-mono">{report.nightCount}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="revisar" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 id="revisar" className="flex items-center gap-2 text-base font-bold">
            <TriangleAlert className="size-5 text-destructive" />
            Para revisar
          </h2>
          {reviewItems.length === 0 ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CircleCheck className="size-4" />
              No hay nada para revisar.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reviewItems.map((item) => (
                <li key={item} className="rounded-xl border p-3 text-[15px]">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        <CopySummary text={summary} />
      </div>
    </div>
  );
}
