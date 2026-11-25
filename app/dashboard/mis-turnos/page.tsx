import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight, HandCoins, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { ensureFixedReservations } from "@/lib/series";
import { RESERVATION_SELECT, type Reservation } from "@/lib/reservations";
import { addDays } from "@/lib/reports";
import {
  MY_TURNS_VIEWS,
  dayLabel,
  groupByDate,
  isDateKey,
  isMonthKey,
  longDayLabel,
  mondayOf,
  monthBounds,
  monthLabel,
  shiftMonth,
  summarizeTurns,
  weekDays,
  type MyTurnsView,
} from "@/lib/my-turns";
import { hoursLabel } from "@/lib/reports";
import { formatMoney } from "@/lib/pricing";
import { DEFAULT_NIGHT_STARTS_AT } from "@/lib/pricing";
import { normalizeTime } from "@/lib/availability";
import {
  WEEKDAY_NAMES,
  addDaysKey,
  hoursText,
  loadProfeSettlements,
  weekStart,
  type SettlementTurn,
} from "@/lib/profe-settlement";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/page-header";
import { ViewTabs } from "@/components/my-turns/view-tabs";
import { TurnCard } from "@/components/my-turns/turn-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mis turnos" };

const CLUB_TZ = "America/Argentina/Buenos_Aires";

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
}

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Mis turnos: los turnos de profe del profesor en tres vistas (hoy, semana e historial por mes).
 * Cada turno vigente se puede editar o cancelar desde acá (menú de tres puntos de la tarjeta); el cobro sigue siendo del personal.
 */
export default async function MisTurnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, membership } = await getSessionContext();

  if (!user || !membership || membership.role !== "profesor") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Esta sección es para los profesores del club.</AlertDescription>
      </Alert>
    );
  }

  const raw = await searchParams;
  const view: MyTurnsView = z
    .enum(MY_TURNS_VIEWS)
    .catch("hoy")
    .parse(typeof raw.vista === "string" ? raw.vista : "hoy");
  const today = todayKey();
  const clubId = membership.club_id;

  // Rango de fechas según la vista.
  let from = today;
  let to = today;
  let monday = mondayOf(today);
  let month = today.slice(0, 7);
  if (view === "semana") {
    monday = mondayOf(isDateKey(raw.semana) ? raw.semana : today);
    from = monday;
    to = addDays(monday, 6);
  } else if (view === "por-pagar") {
    // La vista "Por pagar" usa su propia consulta (abajo).
    from = today;
    to = addDays(today, -1);
  } else if (view === "historial") {
    month = isMonthKey(raw.mes) && raw.mes <= today.slice(0, 7) ? raw.mes : today.slice(0, 7);
    const bounds = monthBounds(month);
    from = bounds.from;
    // El historial son los turnos que ya pasaron: hasta ayer.
    to = bounds.to < today ? bounds.to : addDays(today, -1);
  }

  // Los turnos fijos se generan al mirar sus fechas: hace falta para semanas que nadie abrió todavía.
  if (view === "hoy" || view === "semana") await ensureFixedReservations(supabase, clubId, to);

  const [turnsRes, courtsRes] = await Promise.all([
    from <= to
      ? supabase
          .from("reservations")
          .select(RESERVATION_SELECT)
          .eq("club_id", clubId)
          .eq("kind", "profe")
          .eq("profe_user_id", user.id)
          .gte("date", from)
          .lte("date", to)
          .order("date")
          .order("time")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("courts").select("id, name").eq("club_id", clubId),
  ]);
  const turns = (turnsRes.data ?? []) as Reservation[];

  // Lo que el profe le debe al club por sus turnos (liquidación semanal): hasta el fin de esta semana,
  // mirando medio año para atrás.
  const pendingTo = addDaysKey(weekStart(today), 6);
  const sixMonthsAgo = addDaysKey(weekStart(today), -26 * 7);
  let pendingTurns: SettlementTurn[] = [];
  try {
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("night_starts_at, settle_from")
      .eq("club_id", clubId)
      .maybeSingle();
    // Lo anterior a "Liquidar desde" lo arregla el club por su cuenta: no cuenta como deuda.
    const settleFrom = (settingsRow?.settle_from as string | null) ?? null;
    const pendingFrom = settleFrom && settleFrom > sixMonthsAgo ? settleFrom : sixMonthsAgo;
    const [mine] = await loadProfeSettlements(
      supabase,
      clubId,
      [{ user_id: user.id, name: membership.full_name, color: membership.color }],
      pendingFrom,
      pendingTo,
      normalizeTime(settingsRow?.night_starts_at ?? DEFAULT_NIGHT_STARTS_AT),
      user.id
    );
    pendingTurns = (mine?.turns ?? []).filter((t) => t.due > 0);
  } catch {
    // Si falla, la página sigue mostrando los turnos.
  }
  const pendingTotal = Math.round(pendingTurns.reduce((sum, t) => sum + t.due, 0) * 100) / 100;
  const courtName = new Map(((courtsRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const nameOf = (id: string) => courtName.get(id) ?? "Cancha";
  // Se pueden editar y cancelar los turnos activos de hoy en adelante; el historial y los cancelados quedan como están.
  const isManageable = (turn: Reservation) => turn.status === "active" && turn.date >= today;
  const loadError = turnsRes.error ? "No se pudieron cargar tus turnos." : "";

  const empty = (text: string) => (
    <p className="flex items-center gap-2 rounded-2xl border border-dashed bg-card p-6 text-muted-foreground">
      <CalendarX2 className="size-5 shrink-0" />
      {text}
    </p>
  );

  let content: React.ReactNode;

  if (view === "hoy") {
    const active = turns.filter((t) => t.status === "active");
    content = (
      <section aria-labelledby="titulo-hoy" className="flex flex-col gap-3">
        <h2 id="titulo-hoy" className="text-lg font-bold capitalize">
          {longDayLabel(today)}
          <span className="ml-2 text-sm font-normal text-muted-foreground normal-case">
            {active.length === 0 ? "" : plural(active.length, "turno", "turnos")}
          </span>
        </h2>
        {turns.length === 0 ? (
          empty("No tenés turnos hoy.")
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {turns.map((turn) => (
              <TurnCard key={turn.id} turn={turn} courtName={nameOf(turn.court_id)} canManage={isManageable(turn)} />
            ))}
          </div>
        )}
      </section>
    );
  } else if (view === "semana") {
    const days = weekDays(monday);
    const byDate = new Map(groupByDate(turns).map((g) => [g.date, g.turns]));
    const thisMonday = mondayOf(today);
    const total = turns.filter((t) => t.status === "active").length;
    content = (
      <section aria-labelledby="titulo-semana" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-semana" className="text-lg font-bold">
            {shortDate(days[0])} al {shortDate(days[6])}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{plural(total, "turno", "turnos")}</span>
          </h2>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="icon" aria-label="Semana anterior">
              <Link href={`/dashboard/mis-turnos?vista=semana&semana=${addDays(monday, -7)}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={monday === thisMonday}>
              <Link href="/dashboard/mis-turnos?vista=semana">Esta semana</Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Semana siguiente">
              <Link href={`/dashboard/mis-turnos?vista=semana&semana=${addDays(monday, 7)}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day) => {
            const list = byDate.get(day) ?? [];
            const isToday = day === today;
            return (
              <section
                key={day}
                aria-label={longDayLabel(day)}
                className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border bg-card/60 p-3", isToday && "border-ink")}
              >
                <h3 className="flex items-baseline justify-between text-sm font-bold capitalize">
                  <span>{dayLabel(day)}</span>
                  {isToday && <span className="rounded bg-ball px-1.5 text-[11px] text-ball-foreground">HOY</span>}
                </h3>
                {list.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Sin turnos</p>
                ) : (
                  list.map((turn) => <TurnCard key={turn.id} turn={turn} courtName={nameOf(turn.court_id)} compact canManage={isManageable(turn)} />)
                )}
              </section>
            );
          })}
        </div>
      </section>
    );
  } else if (view === "por-pagar") {
    const weeks = new Map<string, SettlementTurn[]>();
    for (const t of pendingTurns) {
      const key = weekStart(t.date);
      weeks.set(key, [...(weeks.get(key) ?? []), t]);
    }
    content = (
      <section aria-labelledby="titulo-por-pagar" className="flex flex-col gap-4">
        <h2 id="titulo-por-pagar" className="text-lg font-bold">
          Por pagar al club
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            Las canchas de tus turnos se liquidan por semana (lunes a domingo).
          </span>
        </h2>
        {pendingTurns.length === 0 ? (
          empty("No tenés nada pendiente: todos tus turnos están pagados.")
        ) : (
          [...weeks.entries()].map(([monday, list]) => {
            const due = list.reduce((sum, t) => sum + t.due, 0);
            const minutes = list.reduce((sum, t) => sum + t.duration_minutes, 0);
            return (
              <section key={monday} aria-label={`Semana del ${shortDate(monday)}`} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3.5">
                  <h3 className="flex-1 text-base font-bold">
                    Semana del {shortDate(monday)} al {shortDate(addDaysKey(monday, 6))}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {plural(list.length, "turno", "turnos")} · {hoursText(minutes)}
                  </span>
                  <strong className="font-mono">{formatMoney(due)}</strong>
                </div>
                <ul>
                  {list.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-muted px-5 py-2.5 text-[15px] first:border-t-0"
                    >
                      <span className="w-24 font-mono text-sm capitalize">
                        {WEEKDAY_NAMES[new Date(`${t.date}T12:00:00Z`).getUTCDay()].slice(0, 3)} {shortDate(t.date)}
                      </span>
                      <span className="w-14 font-mono text-sm">{t.time}</span>
                      <span className="min-w-0 flex-[1_1_120px] truncate">
                        {t.courtName}
                        <span className="text-sm text-muted-foreground"> · {hoursText(t.duration_minutes)}</span>
                      </span>
                      {t.fixed && <Badge variant="outline">Fijo</Badge>}
                      {t.paid > 0 && <Badge variant="outline">Pagaste {formatMoney(t.paid)}</Badge>}
                      <span className="ml-auto font-mono">{formatMoney(t.due)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </section>
    );
  } else {
    const groups = groupByDate(turns, true);
    const totals = summarizeTurns(turns);
    const currentMonth = today.slice(0, 7);
    content = (
      <section aria-labelledby="titulo-historial" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-historial" className="text-lg font-bold capitalize">
            {monthLabel(month)}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="icon" aria-label="Mes anterior">
              <Link href={`/dashboard/mis-turnos?vista=historial&mes=${shiftMonth(month, -1)}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Mes siguiente" disabled={month >= currentMonth}>
              <Link href={`/dashboard/mis-turnos?vista=historial&mes=${shiftMonth(month, 1)}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-4">
            <span className="text-sm text-muted-foreground">Turnos</span>
            <strong className="font-mono text-2xl">{totals.active}</strong>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-4">
            <span className="text-sm text-muted-foreground">Horas</span>
            <strong className="font-mono text-2xl">{hoursLabel(totals.minutes)}</strong>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-4">
            <span className="text-sm text-muted-foreground">Cancelados</span>
            <strong className="font-mono text-2xl">{totals.cancelled}</strong>
          </div>
        </div>
        {groups.length === 0 ? (
          empty("No tenés turnos pasados en este mes.")
        ) : (
          groups.map((group) => (
            <section key={group.date} aria-label={longDayLabel(group.date)} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted-foreground capitalize">{longDayLabel(group.date)}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.turns.map((turn) => (
                  <TurnCard key={turn.id} turn={turn} courtName={nameOf(turn.court_id)} canManage={isManageable(turn)} />
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mis turnos"
        description="Tus turnos de profe: los de hoy, la semana, el historial y lo que tenés por pagar al club."
        actions={<ViewTabs current={view} />}
      />
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {view !== "por-pagar" && pendingTotal > 0 && (
        <Link
          href="/dashboard/mis-turnos?vista=por-pagar"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-ball px-5 py-4 text-ball-foreground"
        >
          <HandCoins className="size-5" />
          <span className="flex-1">
            Tenés <strong className="font-mono">{formatMoney(pendingTotal)}</strong> por pagar al club (
            {plural(pendingTurns.length, "turno", "turnos")}).
          </span>
          <span className="text-sm font-semibold underline">Ver detalle</span>
        </Link>
      )}
      {content}
    </div>
  );
}
