"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LandPlot, MessageCircle, Plus } from "lucide-react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/shell/page-header";
import {
  CourtTypeFilter,
  type CourtTypeFilterValue,
} from "@/components/court-type-filter";
import { ReservationDialog } from "@/components/reservations/reservation-dialog";
import { useCourts } from "@/hooks/use-courts";
import { useReservations } from "@/hooks/use-reservations";
import { useMembership } from "@/hooks/use-membership";
import { useDayPayments } from "@/hooks/use-day-payments";
import { dateKey, minutesOfDay, useNow } from "@/hooks/use-now";
import { COURT_TYPE_LABELS, type Court } from "@/lib/courts";
import type { Reservation } from "@/lib/reservations";
import { formatMoney } from "@/lib/pricing";
import { buildAvailabilityMessage, defaultSlot, timeToMinutes } from "@/lib/availability";
import {
  amountDue,
  computeDaySummary,
  courtStatusNow,
  freeGaps,
  paidByReservation,
  upcomingReservations,
  type CourtNow,
} from "@/lib/daily-overview";
import {
  RESERVATION_TONE_LABELS,
  toneClasses,
  toneFor,
} from "@/lib/reservation-tone";
import { cn } from "@/lib/utils";

const UPCOMING_LIMIT = 8;
const GAPS_LIMIT = 5;

function KpiCard({
  label,
  value,
  children,
  highlight,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl p-5",
        highlight ? "bg-ball text-ball-foreground" : "border bg-card"
      )}
    >
      <span
        className={cn("text-sm", highlight ? "text-ball-foreground" : "text-muted-foreground")}
      >
        {label}
      </span>
      <strong className="font-display text-[40px] leading-none font-extrabold tabular-nums font-stretch-[125%]">
        {value}
      </strong>
      {children}
    </div>
  );
}

function CourtNowTile({ court, status }: { court: Court; status: CourtNow }) {
  const tone = status.kind === "busy" ? toneFor(status.reservation) : null;
  return (
    <div
      className={cn(
        "flex min-h-26 flex-col gap-1.5 rounded-[14px] p-4",
        tone
          ? toneClasses(tone)
          : status.kind === "free"
            ? "border-[1.5px] border-dashed border-sidebar-label bg-card"
            : "bg-muted text-muted-foreground"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <strong className="text-[15px]">{court.name}</strong>
        <span className="font-mono text-xs uppercase opacity-80">
          {COURT_TYPE_LABELS[court.type]}
        </span>
      </div>
      <span className="min-h-5 truncate text-sm font-semibold">
        {status.kind === "busy"
          ? status.reservation.customer_name
          : status.kind === "free"
            ? "Libre"
            : "Cerrada"}
      </span>
      <span className="font-mono text-[13px]">
        {status.kind === "busy"
          ? `Termina ${status.endsAt}`
          : status.kind === "free"
            ? `Hasta ${status.until}`
            : status.opensAt
              ? `Abre ${status.opensAt}`
              : "Cerró por hoy"}
      </span>
    </div>
  );
}

export default function DashboardIndexPage() {
  const now = useNow();
  const nowMinutes = minutesOfDay(now);
  const todayKey = dateKey(now);
  const [courtTypeFilter, setCourtTypeFilter] =
    useState<CourtTypeFilterValue>("all");
  const [charging, setCharging] = useState<Reservation | null>(null);
  // "Nuevo turno" y "Reservar" abren el alta acá mismo (mismo diálogo que la planilla).
  const [creating, setCreating] = useState<{ courtId: string; time: string } | null>(null);

  const { courts, isLoading: isLoadingCourts, error: courtsError } = useCourts();
  const { membership } = useMembership();
  const {
    reservations,
    isLoading: isLoadingReservations,
    error: reservationsError,
    upsertLocal,
  } = useReservations(todayKey);
  const { payments, refetch: refetchPayments } = useDayPayments(
    reservations.map((r) => r.id)
  );

  const canSeeMoney = membership ? membership.role !== "profesor" : false;

  const visibleCourts = useMemo(
    () =>
      courtTypeFilter === "all"
        ? courts
        : courts.filter((court) => court.type === courtTypeFilter),
    [courts, courtTypeFilter]
  );
  const courtById = useMemo(
    () => new Map(courts.map((c) => [c.id, c])),
    [courts]
  );
  const visibleReservations = useMemo(() => {
    const ids = new Set(visibleCourts.map((c) => c.id));
    return reservations.filter((r) => ids.has(r.court_id));
  }, [reservations, visibleCourts]);

  const summary = computeDaySummary(
    visibleCourts,
    visibleReservations,
    payments,
    nowMinutes
  );
  const paid = paidByReservation(payments);
  const upcoming = upcomingReservations(visibleReservations, nowMinutes).slice(
    0,
    UPCOMING_LIMIT
  );
  const gaps = freeGaps(visibleCourts, visibleReservations, nowMinutes).slice(
    0,
    GAPS_LIMIT
  );
  const availableTypes = [...new Set(courts.map((c) => c.type))];

  const copyGaps = async () => {
    const text = buildAvailabilityMessage({
      dayLabel: "hoy",
      slots: gaps.map((gap) => ({
        time: `${gap.start} a ${gap.end}`,
        label: gap.court.name,
      })),
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado", {
        description: "Pegalo en WhatsApp para ofrecer los turnos libres.",
      });
    } catch {
      toast.error("No se pudo copiar. Probá de nuevo.");
    }
  };

  const isLoading = isLoadingCourts || isLoadingReservations;
  const loadError = courtsError || reservationsError;

  return (
    <AuthGuard>
      <div className="flex flex-col gap-7">
        <PageHeader
          title="Hoy en el club"
          eyebrow={`${now.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })} · ${now.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}`}
          actions={
            <>
              <CourtTypeFilter
                value={courtTypeFilter}
                onChange={setCourtTypeFilter}
                available={availableTypes}
              />
              <Button
                onClick={() => {
                  const court = visibleCourts[0];
                  if (court) setCreating({ courtId: court.id, time: defaultSlot(court, nowMinutes) });
                }}
                disabled={visibleCourts.length === 0}
              >
                <Plus className="text-ball" strokeWidth={2.4} />
                Nuevo turno
              </Button>
            </>
          }
        />

        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : courts.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <LandPlot className="size-6 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Todavía no tenés canchas</h2>
              <p className="text-muted-foreground">
                Creá tu primera cancha para ver acá la ocupación de tu club.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/canchas">Crear tu primera cancha</Link>
            </Button>
          </div>
        ) : (
          <>
            <section
              aria-label="Resumen del día"
              className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
            >
              <KpiCard label="Turnos hoy" value={String(summary.activeCount)}>
                <span className="text-sm text-muted-foreground">
                  {summary.cancelledCount > 0 &&
                    `${summary.cancelledCount} cancelado${summary.cancelledCount === 1 ? "" : "s"} · `}
                  {summary.upcomingCount} por jugar
                </span>
              </KpiCard>
              <KpiCard label="Ocupación" value={`${summary.occupancyPercent}%`}>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`Ocupación del día: ${summary.occupancyPercent}%`}
                >
                  <div
                    className="h-full bg-ink"
                    style={{ width: `${Math.min(100, summary.occupancyPercent)}%` }}
                  />
                </div>
              </KpiCard>
              {canSeeMoney && (
                <>
                  <KpiCard label="Cobrado" value={formatMoney(summary.collected)}>
                    <span className="text-sm text-muted-foreground">
                      Señas y pagos de los turnos de hoy
                    </span>
                  </KpiCard>
                  <KpiCard
                    label="Por cobrar"
                    value={formatMoney(summary.pending)}
                    highlight
                  >
                    <Link
                      href="/dashboard/reservas"
                      className="w-fit text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {summary.pendingCount} turno
                      {summary.pendingCount === 1 ? "" : "s"} sin cobrar · Ver
                    </Link>
                  </KpiCard>
                </>
              )}
            </section>

            <section aria-labelledby="ahora" className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-destructive shadow-[0_0_0_4px_hsl(var(--destructive)/0.15)]" />
                <h2 id="ahora" className="text-lg font-bold">
                  Ahora en cancha
                </h2>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                {visibleCourts.map((court) => (
                  <CourtNowTile
                    key={court.id}
                    court={court}
                    status={courtStatusNow(court, visibleReservations, nowMinutes)}
                  />
                ))}
              </div>
            </section>

            <div className="flex flex-wrap items-start gap-6">
              <section
                aria-labelledby="proximos"
                className="min-w-0 flex-[999_1_520px] overflow-hidden rounded-2xl border bg-card"
              >
                <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                  <h2 id="proximos" className="text-lg font-bold">
                    Próximos turnos
                  </h2>
                  <Link
                    href="/dashboard/reservas"
                    className="text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    Abrir planilla
                  </Link>
                </div>
                {upcoming.length === 0 ? (
                  <p className="px-5 py-8 text-center text-muted-foreground">
                    No quedan turnos por hoy.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[15px]">
                      <thead>
                        <tr className="text-left text-[13px] text-muted-foreground">
                          <th scope="col" className="px-5 py-2.5 font-medium">Hora</th>
                          <th scope="col" className="hidden px-2 py-2.5 font-medium sm:table-cell">Cancha</th>
                          <th scope="col" className="px-2 py-2.5 font-medium">Jugador</th>
                          <th scope="col" className="hidden px-2 py-2.5 font-medium sm:table-cell">Estado</th>
                          <th scope="col" className="px-5 py-2.5">
                            <span className="sr-only">Acción</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcoming.map((r) => {
                          const tone = toneFor(r);
                          const court = courtById.get(r.court_id);
                          const due = amountDue(court, r, paid.get(r.id) ?? 0);
                          return (
                            <tr key={r.id} className="border-t border-muted">
                              <td className="py-2.5 pr-2 pl-4 align-top font-mono font-semibold sm:pl-5 sm:align-middle">{r.time}</td>
                              <td className="hidden px-2 py-2.5 sm:table-cell">{court?.name}</td>
                              <td className="px-2 py-2.5">
                                <span className="font-medium">{r.customer_name}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground sm:hidden">
                                  {court?.name}
                                  <Badge variant={tone}>{RESERVATION_TONE_LABELS[tone]}</Badge>
                                </span>
                              </td>
                              <td className="hidden px-2 py-2.5 sm:table-cell">
                                <Badge variant={tone}>{RESERVATION_TONE_LABELS[tone]}</Badge>
                              </td>
                              <td className="py-1.5 pr-4 pl-2 text-right sm:pr-5">
                                {canSeeMoney && due > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCharging(r)}
                                  >
                                    Cobrar {formatMoney(due)}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section
                aria-labelledby="libres"
                className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-2xl bg-sidebar p-5 text-sidebar-foreground"
              >
                <div className="flex flex-col gap-1">
                  <h2 id="libres" className="text-lg font-bold">
                    Huecos libres hoy
                  </h2>
                  <p className="text-sm text-sidebar-muted">
                    Para responder rápido una consulta o llenar la noche.
                  </p>
                </div>
                {gaps.length === 0 ? (
                  <p className="rounded-xl border border-sidebar-foreground/16 px-3.5 py-4 text-sm text-sidebar-muted">
                    No quedan huecos libres hoy.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {gaps.map((gap) => (
                      <li
                        key={`${gap.court.id}-${gap.start}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-sidebar-foreground/16 px-3.5 py-3"
                      >
                        <span className="flex flex-col gap-0.5">
                          <strong className="font-mono text-base text-ball">
                            {gap.start} – {gap.end}
                          </strong>
                          <span className="text-sm text-sidebar-muted">
                            {gap.court.name} · {COURT_TYPE_LABELS[gap.court.type]}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCreating({
                              courtId: gap.court.id,
                              time: defaultSlot(gap.court, timeToMinutes(gap.start)),
                            })
                          }
                          className="text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ball"
                        >
                          Reservar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  onClick={copyGaps}
                  disabled={gaps.length === 0}
                  className="bg-ball text-ball-foreground hover:bg-ball/90"
                >
                  <MessageCircle />
                  Copiar para WhatsApp
                </Button>
              </section>
            </div>
          </>
        )}

        {membership && creating && (
          <ReservationDialog
            open={!!creating}
            onOpenChange={(open) => !open && setCreating(null)}
            mode="create"
            reservation={null}
            initialCourtId={creating.courtId}
            initialTime={creating.time}
            initialDate={todayKey}
            courts={courts}
            activeReservations={reservations.filter((r) => r.status === "active")}
            membership={membership}
            onSaved={(r) => {
              upsertLocal(r);
              setCreating(null);
              refetchPayments();
            }}
            onCancelled={(r) => upsertLocal(r)}
            showDetail={false}
          />
        )}

        {membership && charging && (
          <ReservationDialog
            open={!!charging}
            onOpenChange={(open) => !open && setCharging(null)}
            mode="edit"
            reservation={charging}
            initialCourtId={charging.court_id}
            initialTime={charging.time}
            initialDate={todayKey}
            courts={courts}
            activeReservations={reservations.filter((r) => r.status === "active")}
            membership={membership}
            onSaved={(r) => {
              upsertLocal(r);
              setCharging((prev) => (prev?.id === r.id ? r : prev));
              refetchPayments();
            }}
            onCancelled={(r) => {
              upsertLocal(r);
              refetchPayments();
            }}
          />
        )}
      </div>
    </AuthGuard>
  );
}
