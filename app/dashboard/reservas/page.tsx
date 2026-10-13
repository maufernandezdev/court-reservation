"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, LandPlot, Plus, Search, Repeat, Trophy } from "lucide-react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/shell/page-header";
import { useCourts } from "@/hooks/use-courts";
import { useReservations } from "@/hooks/use-reservations";
import { useMembership } from "@/hooks/use-membership";
import { useMediaQuery } from "@/hooks/use-media-query";
import { dateKey, minutesOfDay, useNow } from "@/hooks/use-now";
import { useReservationDetail } from "@/hooks/use-reservation-detail";
import { type Court, type CourtType } from "@/lib/courts";
import { defaultSlot, getCourtSlots } from "@/lib/availability";
import { PROFE_COLORS } from "@/lib/profe-colors";
import type { Reservation } from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import {
  RESERVATION_TONES,
  RESERVATION_TONE_LABELS,
  toneClasses,
} from "@/lib/reservation-tone";
import { CourtTypeFilter } from "@/components/court-type-filter";
import { ReservationDialog } from "@/components/reservations/reservation-dialog";
import { ReservationDetailPanel } from "@/components/reservations/reservation-detail-panel";
import { ScheduleGrid } from "@/components/reservations/schedule-grid";
import {
  MobileSchedule,
  NewReservationFab,
} from "@/components/reservations/mobile-schedule";
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

/** Leyenda: estados de pago (turnos estándar) y tipos de turno. */
function StatusLegend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground"
      aria-label="Referencias de la planilla"
    >
      {RESERVATION_TONES.filter((t) => t !== "fixed").map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-3.5 rounded", toneClasses(tone))} />
          {RESERVATION_TONE_LABELS[tone]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-3.5 rounded"
          style={{ background: `linear-gradient(135deg, ${PROFE_COLORS[0].value} 50%, ${PROFE_COLORS[1].value} 50%)` }}
        />
        Profe (color de cada profe)
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={cn("flex size-3.5 items-center justify-center rounded", toneClasses("fixed"))}>
          <Trophy className="size-2.5" />
        </span>
        Torneo
      </li>
      <li className="flex items-center gap-1.5">
        <Repeat aria-hidden="true" className="size-3.5" />
        Fijo
      </li>
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

/** Detalle del turno en celular: hoja desde abajo. */
function ReservationBottomSheet({
  reservation,
  courts,
  membership,
  onSaved,
  onCancelled,
  onEdit,
  onClose,
}: {
  reservation: Reservation | null;
  courts: Court[];
  membership: Membership;
  onSaved: (r: Reservation) => void;
  onCancelled: (r: Reservation) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const detail = useReservationDetail({
    open: !!reservation,
    reservation,
    courts,
    membership,
    onSaved,
    onCancelled,
    onClosed: onClose,
  });

  return (
    <Sheet open={!!reservation} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl px-4 pt-3 pb-8"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-input" />
        <SheetTitle className="sr-only">
          {reservation ? `Turno de ${reservation.customer_name}` : "Turno"}
        </SheetTitle>
        <SheetDescription className="sr-only">Detalle, cobros y cancelación del turno</SheetDescription>
        {reservation && (
          <ReservationDetailPanel
            reservation={reservation}
            membership={membership}
            detail={detail}
            onEdit={onEdit}
          />
        )}
      </SheetContent>
    </Sheet>
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
    openCreateDialog(court.id, defaultSlot(court, isToday ? minutesOfDay(now) : undefined));
  };

  const handleReservationSaved = (reservation: Reservation) => {
    upsertLocal(reservation);
    setEditingReservation((prev) => (prev?.id === reservation.id ? reservation : prev));
  };

  const handleCancelled = (reservation: Reservation) => {
    upsertLocal(reservation);
    setSelectedId(null);
  };

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
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="¿Hay cancha? Buscar turno libre"
            >
              <Search />
            </Button>
            <div className="hidden lg:contents">
            <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                aria-label="Día anterior"
              >
                <ChevronLeft />
              </Button>
              <label className="relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] font-semibold whitespace-nowrap focus-within:outline-2 focus-within:outline-line">
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
            </div>
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
        /* ---------------- Celular: una cancha por vez + hoja de detalle ---------------- */
        <>
          <MobileSchedule
            key={courtTypeFilter}
            courts={visibleCourts}
            reservations={activeReservations}
            selectedDateKey={selectedDateKey}
            todayKey={todayKey}
            nowMinutes={isToday ? minutesOfDay(now) : null}
            onSelectDate={(key) => setSelectedDate(parseDateKey(key))}
            onSelect={(r) => setSelectedId(r.id)}
            onCreate={openCreateDialog}
          />
          <NewReservationFab onClick={openNewFromHeader} />
          {membership && (
            <ReservationBottomSheet
              reservation={selectedReservation}
              courts={courts}
              membership={membership}
              onSaved={handleReservationSaved}
              onCancelled={handleCancelled}
              onEdit={() => selectedReservation && openEditDialog(selectedReservation)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </>
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
          showDetail={false}
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
