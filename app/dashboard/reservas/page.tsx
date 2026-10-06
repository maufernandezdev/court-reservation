"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LandPlot,
  Plus,
  Search,
} from "lucide-react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/shell/page-header";
import { useCourts } from "@/hooks/use-courts";
import { useReservations } from "@/hooks/use-reservations";
import { useMembership } from "@/hooks/use-membership";
import { useMediaQuery } from "@/hooks/use-media-query";
import { dateKey, minutesOfDay, useNow } from "@/hooks/use-now";
import { useReservationDetail } from "@/hooks/use-reservation-detail";
import { COURT_TYPE_LABELS, type Court, type CourtType } from "@/lib/courts";
import {
  getCourtSlots,
  reservationCoversSlot,
  timeToMinutes,
} from "@/lib/availability";
import type { Reservation } from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import {
  RESERVATION_TONES,
  RESERVATION_TONE_LABELS,
  toneClasses,
  toneFor,
} from "@/lib/reservation-tone";
import { CourtTypeFilter } from "@/components/court-type-filter";
import { ReservationDialog } from "@/components/reservations/reservation-dialog";
import { ReservationDetailPanel } from "@/components/reservations/reservation-detail-panel";
import { ScheduleGrid } from "@/components/reservations/schedule-grid";
import { AvailabilitySearchDialog } from "@/components/reservations/availability-search-dialog";
import { cn } from "@/lib/utils";

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Leyenda de estados (sin "fijo", que todavía no existe). */
function StatusLegend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground"
      aria-label="Estados del turno"
    >
      {RESERVATION_TONES.filter((t) => t !== "fixed").map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-3.5 rounded", toneClasses(tone))} />
          {RESERVATION_TONE_LABELS[tone]}
        </li>
      ))}
    </ul>
  );
}

/** Panel lateral de escritorio con el detalle del turno seleccionado. */
function ReservationSidePanel({
  reservation,
  courts,
  membership,
  onSaved,
  onCancelled,
  onEdit,
  onClose,
}: {
  reservation: Reservation;
  courts: Court[];
  membership: Membership;
  onSaved: (r: Reservation) => void;
  onCancelled: (r: Reservation) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const detail = useReservationDetail({
    open: true,
    reservation,
    courts,
    membership,
    onSaved,
    onCancelled,
    onClosed: onClose,
  });

  return (
    <aside
      aria-label="Detalle del turno"
      className="sticky top-6 max-h-[calc(100vh-3rem)] w-[360px] shrink-0 self-start overflow-y-auto rounded-2xl border bg-card p-5"
    >
      <ReservationDetailPanel
        reservation={reservation}
        membership={membership}
        detail={detail}
        onEdit={onEdit}
        onClose={onClose}
      />
    </aside>
  );
}

function ReservationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const now = useNow();
  const todayKey = dateKey(now);

  const { courts, isLoading: isLoadingCourts } = useCourts();
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [courtTypeFilter, setCourtTypeFilter] = useState<CourtType | "all">("all");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [initialCourtId, setInitialCourtId] = useState("");
  const [initialTime, setInitialTime] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileCourtId, setMobileCourtId] = useState("");

  const selectedDateKey = useMemo(() => dateKey(selectedDate), [selectedDate]);
  const isToday = selectedDateKey === todayKey;

  // "Buscar" de la barra inferior navega con ?buscar=1: abre el buscador y limpia la URL.
  useEffect(() => {
    if (searchParams.get("buscar") === "1") {
      setSearchOpen(true);
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const { reservations, isLoading: isLoadingReservations, upsertLocal } =
    useReservations(selectedDateKey);

  const activeReservations = useMemo(
    () => reservations.filter((r) => r.status === "active"),
    [reservations]
  );

  const visibleCourts = useMemo(
    () =>
      courtTypeFilter === "all"
        ? courts
        : courts.filter((court) => court.type === courtTypeFilter),
    [courts, courtTypeFilter]
  );

  const selectedReservation = selectedId
    ? (reservations.find((r) => r.id === selectedId) ?? null)
    : null;

  const openCreateDialog = (courtId: string, time: string, date?: string) => {
    const court = courts.find((c) => c.id === courtId);
    let slotTime = time;

    if (court) {
      const slots = getCourtSlots(court);
      if (!slots.includes(time)) {
        // Celda fuera de la grilla de la cancha: usa la primera franja disponible desde ahí.
        slotTime = slots.find((s) => s >= time) ?? slots[slots.length - 1] ?? time;
      }
    }

    setDialogMode("create");
    setEditingReservation(null);
    setInitialCourtId(courtId);
    setInitialTime(slotTime);
    if (date && date !== selectedDateKey) {
      setSelectedDate(parseDateKey(date));
    }
    setDialogOpen(true);
  };

  const openEditDialog = (reservation: Reservation) => {
    setDialogMode("edit");
    setEditingReservation(reservation);
    setInitialCourtId(reservation.court_id);
    setInitialTime(reservation.time);
    setDialogOpen(true);
  };

  /** "Nuevo turno": primera cancha visible, primera franja desde ahora (o desde la apertura). */
  const openNewFromHeader = () => {
    const court = visibleCourts[0];
    if (!court) return;
    const slots = getCourtSlots(court);
    const nowMin = minutesOfDay(now);
    const time =
      (isToday ? slots.find((s) => timeToMinutes(s) >= nowMin) : undefined) ??
      slots[0] ??
      court.open_time;
    openCreateDialog(court.id, time);
  };

  const handleReservationSaved = (reservation: Reservation) => {
    upsertLocal(reservation);
    setEditingReservation((prev) => (prev?.id === reservation.id ? reservation : prev));
  };

  const handleCancelled = (reservation: Reservation) => {
    upsertLocal(reservation);
    setSelectedId(null);
  };

  const effectiveMobileCourtId =
    mobileCourtId && visibleCourts.some((c) => c.id === mobileCourtId)
      ? mobileCourtId
      : (visibleCourts[0]?.id ?? "");

  const isLoading = isLoadingCourts || isLoadingReservations || isLoadingMembership;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <LandPlot className="size-6 text-muted-foreground" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Todavía no tenés canchas</h2>
          <p className="text-sm text-muted-foreground">
            Creá tu primera cancha para empezar a cargar reservas.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/canchas">Crear tu primera cancha</Link>
        </Button>
      </div>
    );
  }

  const rawDateLabel = selectedDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dateLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);
  const availableTypes = [...new Set(courts.map((c) => c.type))];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Planilla"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                aria-label="Día anterior"
              >
                <ChevronLeft />
              </Button>
              <label className="relative flex cursor-pointer items-center gap-2 px-2 text-[15px] font-semibold whitespace-nowrap">
                <CalendarDays className="size-4 text-muted-foreground" />
                {dateLabel}
                <Input
                  type="date"
                  value={selectedDateKey}
                  onChange={(e) =>
                    e.target.value && setSelectedDate(parseDateKey(e.target.value))
                  }
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  aria-label="Elegir fecha"
                  className="absolute inset-0 h-full cursor-pointer opacity-0"
                />
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                aria-label="Día siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
            {isToday ? (
              <span className="rounded-md bg-ink px-2 py-1 font-mono text-xs font-semibold text-ball">
                HOY
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                Volver a hoy
              </Button>
            )}
            <CourtTypeFilter
              value={courtTypeFilter}
              onChange={setCourtTypeFilter}
              available={availableTypes}
            />
            <Button variant="outline" onClick={() => setSearchOpen(true)}>
              <Search />
              ¿Hay cancha?
            </Button>
            <Button onClick={openNewFromHeader}>
              <Plus className="text-ball" strokeWidth={2.4} />
              Nuevo turno
            </Button>
          </>
        }
      />

      {visibleCourts.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          No hay canchas del tipo seleccionado.
        </p>
      ) : isDesktop ? (
        /* ---------------- Escritorio: grilla + panel de detalle ---------------- */
        <>
          <StatusLegend />
          <div className="flex items-start gap-5">
            <div className="min-w-0 flex-1">
              <ScheduleGrid
                courts={visibleCourts}
                reservations={activeReservations.filter((r) =>
                  visibleCourts.some((c) => c.id === r.court_id)
                )}
                nowMinutes={isToday ? minutesOfDay(now) : null}
                selectedId={selectedReservation?.id ?? null}
                onSelect={(r) => setSelectedId(r.id)}
                onCreate={openCreateDialog}
              />
            </div>
            {membership && selectedReservation && (
              <ReservationSidePanel
                key={selectedReservation.id}
                reservation={selectedReservation}
                courts={courts}
                membership={membership}
                onSaved={handleReservationSaved}
                onCancelled={handleCancelled}
                onEdit={() => openEditDialog(selectedReservation)}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </>
      ) : (
        /* ---------------- Celular: cancha seleccionada + lista de franjas ---------------- */
        <Tabs
          value={effectiveMobileCourtId}
          onValueChange={setMobileCourtId}
          className="space-y-4"
        >
          <TabsList className="flex w-full justify-start overflow-x-auto">
            {visibleCourts.map((court) => (
              <TabsTrigger key={court.id} value={court.id} className="shrink-0">
                {court.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleCourts.map((court) => (
            <TabsContent key={court.id} value={court.id} className="m-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {COURT_TYPE_LABELS[court.type]} · {court.open_time} a {court.close_time}
                  </span>
                  <span>{court.slot_duration} min por turno</span>
                </div>
                <ul className="divide-y rounded-xl border bg-card">
                  {getCourtSlots(court).map((time) => {
                    const reservation = activeReservations.find(
                      (r) => r.court_id === court.id && reservationCoversSlot(r, time)
                    );
                    const isStart = reservation && reservation.time === time;
                    if (reservation && !isStart) return null;
                    const tone = reservation ? toneFor(reservation) : null;

                    return (
                      <li key={time}>
                        <button
                          type="button"
                          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                          onClick={() =>
                            reservation
                              ? openEditDialog(reservation)
                              : openCreateDialog(court.id, time)
                          }
                        >
                          <span className="font-mono font-medium">{time}</span>
                          {reservation && tone ? (
                            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                              <span className="truncate text-sm font-semibold">
                                {reservation.customer_name}
                              </span>
                              <Badge variant={tone}>{RESERVATION_TONE_LABELS[tone]}</Badge>
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Libre</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {membership && (
        <ReservationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={dialogMode}
          reservation={editingReservation}
          initialCourtId={initialCourtId}
          initialTime={initialTime}
          initialDate={selectedDateKey}
          courts={courts}
          activeReservations={activeReservations}
          membership={membership}
          onSaved={handleReservationSaved}
          onCancelled={handleCancelled}
          showDetail={!isDesktop}
        />
      )}

      <AvailabilitySearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        courts={courts}
        activeReservations={activeReservations}
        defaultDate={selectedDateKey}
        onSelect={(courtId, time, date) => openCreateDialog(courtId, time, date)}
      />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <ReservationsPageContent />
      </Suspense>
    </AuthGuard>
  );
}
