import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { queryProfes } from "@/lib/club-data";
import { CLUB_TZ, clubTodayKey } from "@/lib/club-time";
import { formatMoney } from "@/lib/pricing";
import {
  SETTLE_FROM_FALLBACK,
  WEEKDAY_NAMES,
  addDaysKey,
  hoursText,
  loadProfeSettlements,
  settlementText,
  shortDay,
  weekStart,
  type ProfeSettlement,
  type ProfeSettlementRecord,
} from "@/lib/profe-settlement";
import { DEFAULT_NIGHT_STARTS_AT } from "@/lib/pricing";
import { normalizeTime } from "@/lib/availability";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/reservations";
import { CopyTextButton } from "@/components/reports/copy-text-button";
import { PrintButton } from "@/components/reports/print-button";
import { FALLBACK_PROFE_COLOR } from "@/lib/profe-colors";
import { PageHeader } from "@/components/shell/page-header";
import { SettleProfeDialog } from "@/components/settlements/settle-profe-dialog";
import { SettleFromDialog } from "@/components/settlements/settle-from-dialog";
import { SettleUntilPicker } from "@/components/settlements/settle-until-picker";
import { VoidSettlementButton } from "@/components/settlements/void-settlement-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Liquidación de profes" };

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${shortDay(key)}`;
}

/** Minutos transcurridos del día en el club (mismo criterio que `now_minutes_ar` en la base). */
function clubNowMinutes(now: Date = new Date()): number {
  const [h, m] = now
    .toLocaleTimeString("en-GB", { timeZone: CLUB_TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

/** "25/11 14:30" en hora del club. */
function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: CLUB_TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paidOnLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: CLUB_TZ, day: "2-digit", month: "2-digit" });
}

/**
 * Liquidación de profes. Dos vistas que conviven:
 * - Liquidar: todo lo que cada profe tiene pendiente (turnos ya jugados) desde "Liquidar desde" hasta
 *   una fecha. Cada profe paga cuando le queda cómodo (por día, por semana…). Las liquidaciones quedan
 *   en un historial y se pueden deshacer.
 * - Semana: la vista de lunes a domingo para mirar lo usado y lo pagado.
 */
export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo los administradores cobran las liquidaciones de los profes.</AlertDescription>
      </Alert>
    );
  }

  const raw = await searchParams;
  const view = raw.vista === "semana" ? "semana" : "liquidar";
  const today = clubTodayKey();
  const clubId = membership.club_id;

  let loadError = "";
  let profes: { user_id: string; name: string; color: string | null }[] = [];
  let nightStartsAt = DEFAULT_NIGHT_STARTS_AT;
  let settleFrom: string | null = null;
  try {
    const [profeRows, { data: settingsRow }] = await Promise.all([
      queryProfes(supabase, clubId),
      supabase.from("settings").select("night_starts_at, settle_from").eq("club_id", clubId).maybeSingle(),
    ]);
    profes = profeRows;
    nightStartsAt = normalizeTime(settingsRow?.night_starts_at ?? DEFAULT_NIGHT_STARTS_AT);
    settleFrom = (settingsRow?.settle_from as string | null) ?? null;
  } catch {
    loadError = "No se pudieron cargar los profes.";
  }

  const tabs = (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1 print:hidden" role="navigation" aria-label="Vista">
      <Button asChild size="sm" variant={view === "liquidar" ? "default" : "ghost"}>
        <Link href="/dashboard/liquidaciones" aria-current={view === "liquidar" ? "page" : undefined}>
          Liquidar
        </Link>
      </Button>
      <Button asChild size="sm" variant={view === "semana" ? "default" : "ghost"}>
        <Link href="/dashboard/liquidaciones?vista=semana" aria-current={view === "semana" ? "page" : undefined}>
          Semana
        </Link>
      </Button>
    </div>
  );

  if (view === "semana") {
    return (
      <WeekView
        raw={raw}
        today={today}
        tabs={tabs}
        loadError={loadError}
        load={(from, to) => loadProfeSettlements(supabase, clubId, profes, from, to, nightStartsAt)}
        clubName={membership.club.name}
      />
    );
  }

  // ---- Liquidar: todo lo pendiente hasta una fecha ----
  const parsedUntil = dateKeySchema.catch(today).parse(typeof raw.hasta === "string" ? raw.hasta : today);
  let until = parsedUntil > today ? today : parsedUntil;
  if (settleFrom && until < settleFrom) until = settleFrom > today ? today : settleFrom;
  const fromKey = settleFrom ?? SETTLE_FROM_FALLBACK;
  const startsInFuture = !!settleFrom && settleFrom > today;
  const periodLabel = `${settleFrom ? `Del ${shortDay(settleFrom)}` : "Todo lo pendiente"} hasta el ${shortDay(until)}`;
  const untilHref = (key: string) => (key === today ? "/dashboard/liquidaciones" : `/dashboard/liquidaciones?hasta=${key}`);
  const shortcuts = [
    { key: today, label: "Hoy" },
    { key: addDaysKey(today, -1), label: "Ayer" },
    { key: addDaysKey(weekStart(today), -1), label: "Domingo pasado" },
  ].filter((s) => !settleFrom || s.key >= settleFrom);

  let pending: ProfeSettlement[] = [];
  let history: ProfeSettlementRecord[] = [];
  if (!loadError) {
    try {
      const [pendingRows, { data: historyRows, error: historyError }] = await Promise.all([
        startsInFuture
          ? Promise.resolve([] as ProfeSettlement[])
          : loadProfeSettlements(supabase, clubId, profes, fromKey, until, nightStartsAt, undefined, {
              today,
              nowMinutes: clubNowMinutes(),
            }),
        supabase
          .from("profe_settlements")
          .select("id, profe_user_id, period_from, period_to, method, amount, turns_count, created_at, voided_at")
          .eq("club_id", clubId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (historyError) throw historyError;
      pending = pendingRows.filter((p) => p.turns.length > 0);
      history = ((historyRows ?? []) as ProfeSettlementRecord[]).map((h) => ({ ...h, amount: Number(h.amount) }));
    } catch {
      loadError = "No se pudieron cargar los turnos de los profes.";
    }
  }
  const totalDue = Math.round(pending.reduce((s, p) => s + p.due, 0) * 100) / 100;
  const nameOf = new Map(profes.map((p) => [p.user_id, p.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liquidación de profes"
        eyebrow={periodLabel}
        description="Lo que cada profe tiene pendiente por los turnos que ya jugó. Cada uno paga cuando le queda cómodo."
        actions={tabs}
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <SettleFromDialog settleFrom={settleFrom} />
        <span className="ml-auto text-sm text-muted-foreground">Hasta</span>
        {shortcuts.map((s) => (
          <Button key={s.label} asChild size="sm" variant={s.key === until ? "default" : "outline"}>
            <Link href={untilHref(s.key)}>{s.label}</Link>
          </Button>
        ))}
        <SettleUntilPicker value={until} min={settleFrom ?? undefined} max={today} />
      </div>

      {startsInFuture && (
        <Alert>
          <AlertDescription>
            Las liquidaciones empiezan el {shortDay(settleFrom!)}. Hasta entonces no hay nada pendiente para cobrar acá.
          </AlertDescription>
        </Alert>
      )}
      {!settleFrom && (
        <Alert>
          <AlertDescription>
            Sin “Liquidar desde”, acá aparece todo lo que los profes tienen sin pagar, de cualquier fecha.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
        <section className="flex flex-col gap-1 rounded-2xl bg-ball p-5 text-ball-foreground">
          <h2 className="text-sm font-medium">Falta cobrar</h2>
          <strong className="font-mono text-3xl font-bold">{formatMoney(totalDue)}</strong>
          <span className="text-sm">{periodLabel}</span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Profes con turnos pendientes</h2>
          <strong className="font-mono text-2xl font-bold">{pending.length}</strong>
        </section>
      </div>

      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="print-area flex flex-col gap-4">
        <h2 className="hidden text-lg font-bold print:block">
          Liquidación de profes · {membership.club.name} · {periodLabel}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            {profes.length === 0
              ? "No hay profes en el equipo. Sumalos en Equipo para liquidar sus turnos."
              : "Ningún profe tiene turnos jugados sin pagar en este período."}
          </p>
        ) : (
          pending.map((profe) => (
            <ProfeCard
              key={profe.user_id}
              profe={profe}
              clubName={membership.club.name}
              periodLabel={periodLabel}
              emptyText=""
              action={
                profe.due > 0 || profe.turns.length > 0 ? (
                  <SettleProfeDialog
                    profeUserId={profe.user_id}
                    profeName={profe.name}
                    until={until}
                    periodLabel={periodLabel}
                    due={profe.due}
                    turns={profe.turns.length}
                  />
                ) : null
              }
            />
          ))
        )}
      </div>

      <section aria-labelledby="settlement-history" className="flex flex-col gap-3 print:hidden">
        <h2 id="settlement-history" className="text-lg font-bold">
          Historial de liquidaciones
        </h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Todavía no hay liquidaciones registradas. Las cobradas antes de este cambio están en Actividad y no se pueden
            deshacer desde acá.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border bg-card">
            {history.map((h) => {
              const name = nameOf.get(h.profe_user_id) ?? "Profe (fuera del equipo)";
              return (
                <li
                  key={h.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-muted px-5 py-3 text-[15px] first:border-t-0",
                    h.voided_at && "text-muted-foreground"
                  )}
                >
                  <span className="w-24 font-mono text-sm">{dateTimeLabel(h.created_at)}</span>
                  <span className="min-w-0 flex-[1_1_160px] truncate font-medium">{name}</span>
                  <span className="text-sm text-muted-foreground">
                    {h.period_from ? `${shortDay(h.period_from)} al ${shortDay(h.period_to)}` : `hasta el ${shortDay(h.period_to)}`} ·{" "}
                    {h.turns_count} {h.turns_count === 1 ? "turno" : "turnos"} ·{" "}
                    {PAYMENT_METHOD_LABELS[h.method as PaymentMethod] ?? h.method}
                  </span>
                  <span className={cn("ml-auto font-mono", h.voided_at && "line-through")}>{formatMoney(h.amount)}</span>
                  {h.voided_at ? (
                    <Badge variant="outline">Deshecha</Badge>
                  ) : (
                    <VoidSettlementButton
                      settlementId={h.id}
                      profeName={name}
                      amount={h.amount}
                      turns={h.turns_count}
                      paidOn={paidOnLabel(h.created_at)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Vista semanal (lunes a domingo) para mirar lo usado y lo pagado. Para cobrar se usa Liquidar. */
async function WeekView({
  raw,
  today,
  tabs,
  loadError: initialError,
  load,
  clubName,
}: {
  raw: Record<string, string | string[] | undefined>;
  today: string;
  tabs: ReactNode;
  loadError: string;
  load: (from: string, to: string) => Promise<ProfeSettlement[]>;
  clubName: string;
}) {
  const currentWeek = weekStart(today);
  const from = weekStart(dateKeySchema.catch(currentWeek).parse(typeof raw.semana === "string" ? raw.semana : currentWeek));
  const to = addDaysKey(from, 6);
  const periodLabel = `Semana del ${shortDay(from)} al ${shortDay(to)}`;
  const weekHref = (key: string) =>
    key === currentWeek ? "/dashboard/liquidaciones?vista=semana" : `/dashboard/liquidaciones?vista=semana&semana=${key}`;

  let loadError = initialError;
  let settlements: ProfeSettlement[] = [];
  if (!loadError) {
    try {
      settlements = await load(from, to);
    } catch {
      loadError = "No se pudieron cargar los turnos de los profes.";
    }
  }
  const totalDue = settlements.reduce((s, p) => s + p.due, 0);
  const totalPaid = settlements.reduce((s, p) => s + p.paid, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liquidación de profes"
        eyebrow={periodLabel}
        description="Lo que cada profe usó en la semana y cuánto ya pagó. Para cobrar, usá Liquidar."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs}
            <Button asChild variant="outline" size="icon" aria-label="Semana anterior">
              <Link href={weekHref(addDaysKey(from, -7))}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={weekHref(currentWeek)}>Esta semana</Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Semana siguiente">
              <Link href={weekHref(addDaysKey(from, 7))}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
        <section className="flex flex-col gap-1 rounded-2xl bg-ball p-5 text-ball-foreground">
          <h2 className="text-sm font-medium">Sin pagar</h2>
          <strong className="font-mono text-3xl font-bold">{formatMoney(totalDue)}</strong>
          <span className="text-sm">{periodLabel}</span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Ya cobrado</h2>
          <strong className="font-mono text-2xl font-bold">{formatMoney(totalPaid)}</strong>
        </section>
      </div>

      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="print-area flex flex-col gap-4">
        <h2 className="hidden text-lg font-bold print:block">
          Liquidación de profes · {clubName} · {periodLabel}
        </h2>
        {settlements.length === 0 ? (
          <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            No hay profes en el equipo. Sumalos en Equipo para liquidar sus turnos.
          </p>
        ) : (
          settlements.map((profe) => (
            <ProfeCard
              key={profe.user_id}
              profe={profe}
              clubName={clubName}
              periodLabel={periodLabel}
              emptyText="Sin turnos esta semana."
              action={
                profe.due > 0 ? (
                  <Badge variant="outline">Falta {formatMoney(profe.due)}</Badge>
                ) : profe.turns.length > 0 ? (
                  <Badge variant="outline">Pagado</Badge>
                ) : null
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Tarjeta de un profe: resumen (turnos, horas, día/noche, por día y cancha) y detalle de turnos. */
function ProfeCard({
  profe,
  clubName,
  periodLabel,
  emptyText,
  action,
}: {
  profe: ProfeSettlement;
  clubName: string;
  periodLabel: string;
  emptyText: string;
  action: ReactNode;
}) {
  return (
    <section aria-label={profe.name} className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3.5">
        <span
          aria-hidden="true"
          className="size-3 rounded-full"
          style={{ backgroundColor: profe.color ?? FALLBACK_PROFE_COLOR }}
        />
        <h2 className="min-w-0 flex-[1_1_160px] truncate text-base font-bold">{profe.name}</h2>
        <span className="text-sm text-muted-foreground">
          {profe.turns.length} {profe.turns.length === 1 ? "turno" : "turnos"} · {formatMoney(profe.total)}
        </span>
        {action && <span className="print:hidden">{action}</span>}
      </div>
      {profe.turns.length > 0 && (
        <div className="flex flex-col gap-4 border-b bg-muted/30 px-5 py-4">
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(120px,100%),1fr))] gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Turnos</dt>
              <dd className="font-mono text-base font-semibold">
                {profe.turns.length}
                {profe.summary.fixedCount > 0 && (
                  <span className="text-sm font-normal text-muted-foreground"> · {profe.summary.fixedCount} fijos</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Horas</dt>
              <dd className="font-mono text-base font-semibold">{hoursText(profe.summary.minutes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Día / noche</dt>
              <dd className="font-mono">
                {hoursText(profe.summary.dayMinutes)} / {hoursText(profe.summary.nightMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total · ya pagado · falta</dt>
              <dd className="font-mono">
                {formatMoney(profe.total)} · {formatMoney(profe.paid)} · {formatMoney(profe.due)}
              </dd>
            </div>
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <dl className="flex flex-col text-sm">
              <dt className="pb-1 font-semibold">Por día</dt>
              {profe.summary.byWeekday.map((d) => (
                <div key={d.weekday} className="flex justify-between border-t border-muted py-1">
                  <dt className="capitalize">{WEEKDAY_NAMES[d.weekday]}</dt>
                  <dd className="font-mono">
                    {d.turns} · {hoursText(d.minutes)}
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="flex flex-col text-sm">
              <dt className="pb-1 font-semibold">Por cancha</dt>
              {profe.summary.byCourt.map((c) => (
                <div key={c.name} className="flex justify-between gap-3 border-t border-muted py-1">
                  <dt className="truncate">{c.name}</dt>
                  <dd className="font-mono">
                    {hoursText(c.minutes)} · {formatMoney(c.amount)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="print:hidden">
            <CopyTextButton text={settlementText(profe, clubName, periodLabel, formatMoney)} />
          </div>
        </div>
      )}
      {profe.turns.length === 0 ? (
        emptyText ? <p className="px-5 py-4 text-sm text-muted-foreground">{emptyText}</p> : null
      ) : (
        <ul>
          {profe.turns.map((turn) => (
            <li
              key={turn.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-muted px-5 py-2.5 text-[15px] first:border-t-0",
                turn.due === 0 && "text-muted-foreground"
              )}
            >
              <span className="w-24 font-mono text-sm">{dayLabel(turn.date)}</span>
              <span className="w-14 font-mono text-sm">{turn.time}</span>
              <span className="min-w-0 flex-[1_1_120px] truncate">
                {turn.courtName}
                <span className="text-sm text-muted-foreground"> · {hoursText(turn.duration_minutes)}</span>
              </span>
              {turn.fixed && <Badge variant="outline">Fijo</Badge>}
              {turn.night && <Badge variant="outline">Noche</Badge>}
              {turn.due === 0 ? (
                <Badge variant="outline">Pagado</Badge>
              ) : turn.paid > 0 ? (
                <Badge variant="outline">Pagó {formatMoney(turn.paid)}</Badge>
              ) : null}
              <span className="ml-auto font-mono">{formatMoney(turn.due > 0 ? turn.due : turn.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
