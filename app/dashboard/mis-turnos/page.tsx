import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
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
  } else if (view === "historial") {
    month = isMonthKey(raw.mes) && raw.mes <= today.slice(0, 7) ? raw.mes : today.slice(0, 7);
    const bounds = monthBounds(month);
    from = bounds.from;
    // El historial son los turnos que ya pasaron: hasta ayer.
    to = bounds.to < today ? bounds.to : addDays(today, -1);
  }

  // Los turnos fijos se generan al mirar sus fechas: hace falta para semanas que nadie abrió todavía.
  if (view !== "historial") await ensureFixedReservations(supabase, clubId, to);

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
        description="Tus turnos de profe: los de hoy, la semana y el historial."
        actions={<ViewTabs current={view} />}
      />
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {content}
    </div>
  );
}
