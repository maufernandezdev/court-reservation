"use client";

import { useMemo, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useCourts } from "@/hooks/use-courts";
import { useReservations } from "@/hooks/use-reservations";
import { useMembership } from "@/hooks/use-membership";
import { useMediaQuery } from "@/hooks/use-media-query";
import { COURT_TYPE_LABELS, type CourtType } from "@/lib/courts";
import {
  getCourtSlots,
  minutesToTime,
  reservationCoversSlot,
  timeToMinutes,
} from "@/lib/availability";
import {
  PAYMENT_STATUS_LABELS,
  type Reservation,
} from "@/lib/reservations";
import { CourtTypeFilter } from "@/components/court-type-filter";
import { ReservationDialog } from "@/components/reservations/reservation-dialog";
import { AvailabilitySearchDialog } from "@/components/reservations/availability-search-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarSearch,
  LandPlot,
} from "lucide-react";

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Grilla base de 30 min entre el menor apertura y el mayor cierre de las canchas visibles. */
function buildGridTimes(
  courts: { open_time: string; close_time: string }[]
): string[] {
  if (courts.length === 0) return [];
  const start = Math.min(...courts.map((c) => timeToMinutes(c.open_time)));
  const end = Math.max(...courts.map((c) => timeToMinutes(c.close_time)));
  const times: string[] = [];
  for (let t = start; t < end; t += 30) {
    times.push(minutesToTime(t));
  }
  return times;
}

export default function ReservationsPage() {
  const { courts, isLoading: isLoadingCourts } = useCourts();
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [courtTypeFilter, setCourtTypeFilter] = useState<CourtType | "all">(
    "all"
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);
  const [initialCourtId, setInitialCourtId] = useState("");
  const [initialTime, setInitialTime] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileCourtId, setMobileCourtId] = useState("");

  const selectedDateKey = useMemo(
    () => formatDateKey(selectedDate),
    [selectedDate]
  );

  const {
    reservations,
    isLoading: isLoadingReservations,
    upsertLocal,
    refetch,
  } = useReservations(selectedDateKey);

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

  const findReservation = (courtId: string, time: string) =>
    activeReservations.find(
      (r) => r.court_id === courtId && reservationCoversSlot(r, time)
    );

  const openCreateDialog = (courtId: string, time: string, date?: string) => {
    const court = courts.find((c) => c.id === courtId);
    let slotTime = time;

    if (court) {
      const slots = getCourtSlots(court);
      if (!slots.includes(time)) {
        // Celda fuera de la grilla de la cancha: usa la primera franja disponible desde ahí.
        slotTime =
          slots.find((s) => s >= time) ?? slots[slots.length - 1] ?? time;
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

  const handleCellClick = (courtId: string, time: string) => {
    const existing = findReservation(courtId, time);
    if (existing) {
      if (existing.time === time) {
        openEditDialog(existing);
      }
      return;
    }
    openCreateDialog(courtId, time);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      setSelectedDate(parseDateKey(value));
    }
  };

  const gridTimes = useMemo(
    () => buildGridTimes(visibleCourts),
    [visibleCourts]
  );

  const handleReservationSaved = (reservation: Reservation) => {
    upsertLocal(reservation);
    setEditingReservation((prev) => (prev?.id === reservation.id ? reservation : prev));
  };

  const effectiveMobileCourtId =
    mobileCourtId &&
    visibleCourts.some((c) => c.id === mobileCourtId)
      ? mobileCourtId
      : (visibleCourts[0]?.id ?? "");

  const mobileCourt = visibleCourts.find(
    (c) => c.id === effectiveMobileCourtId
  );

  const isLoading =
    isLoadingCourts || isLoadingReservations || isLoadingMembership;

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AuthGuard>
    );
  }

  if (courts.length === 0) {
    return (
      <AuthGuard>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <LandPlot className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              Todavía no tenés canchas
            </h2>
            <p className="text-sm text-muted-foreground">
              Creá tu primera cancha para empezar a cargar reservas.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/canchas">Crear tu primera cancha</Link>
          </Button>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-4 border-b bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:-mx-8 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
            <p className="text-muted-foreground">
              Vista diaria. Tocá una franja libre para reservar o una ocupada
              para ver el detalle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setSearchOpen(true)}>
              <CalendarSearch className="mr-2 h-4 w-4" />
              Buscar disponibilidad
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              title="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium capitalize">
                {formatDisplayDate(selectedDate)}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              title="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Input
              type="date"
              value={selectedDateKey}
              onChange={handleDateInputChange}
              className="w-auto"
            />

            <CourtTypeFilter
              value={courtTypeFilter}
              onChange={setCourtTypeFilter}
            />
          </div>
        </div>

        {visibleCourts.length === 0 ? (
          <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            No hay canchas del tipo seleccionado.
          </p>
        ) : isDesktop ? (
          /* ---------------- Vista desktop: grilla canchas × horarios ---------------- */
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-20 border-r">Hora</TableHead>
                  {visibleCourts.map((court) => (
                    <TableHead
                      key={court.id}
                      className="min-w-[140px] text-center"
                    >
                      <div className="font-semibold">{court.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {COURT_TYPE_LABELS[court.type]} ·{" "}
                        {court.slot_duration} min
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridTimes.map((time) => (
                  <TableRow key={time}>
                    <TableCell className="border-r font-medium">
                      {time}
                    </TableCell>
                    {visibleCourts.map((court) => {
                      const reservation = findReservation(court.id, time);
                      const isStart =
                        reservation && reservation.time === time;
                      const inGrid = getCourtSlots(court).includes(time);

                      if (reservation && !isStart) {
                        // Continuación de un turno más largo que la grilla.
                        return (
                          <TableCell
                            key={`${court.id}-${time}`}
                            className="h-10 bg-primary/5 p-2"
                          />
                        );
                      }

                      return (
                        <TableCell
                          key={`${court.id}-${time}`}
                          className={cn(
                            "h-16 p-2 text-center transition-colors",
                            reservation
                              ? "cursor-pointer bg-primary/10 hover:bg-primary/20"
                              : inGrid
                                ? "cursor-pointer hover:bg-accent"
                                : "bg-muted/20"
                          )}
                          onClick={() =>
                            reservation || inGrid
                              ? handleCellClick(court.id, time)
                              : undefined
                          }
                        >
                          {reservation ? (
                            <div className="flex h-full flex-col items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {reservation.customer_name}
                              </span>
                              <Badge
                                variant={
                                  reservation.payment_status === "pagada"
                                    ? "default"
                                    : reservation.payment_status === "senada"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="mt-0.5"
                              >
                                {PAYMENT_STATUS_LABELS[
                                  reservation.payment_status
                                ]}
                              </Badge>
                            </div>
                          ) : inGrid ? (
                            <span className="text-xs text-muted-foreground">
                              Libre
                            </span>
                          ) : null}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* ---------------- Vista mobile: cancha seleccionada + lista de franjas ---------------- */
          <Tabs
            value={effectiveMobileCourtId}
            onValueChange={setMobileCourtId}
            className="space-y-4"
          >
            <TabsList className="flex w-full justify-start overflow-x-auto">
              {visibleCourts.map((court) => (
                <TabsTrigger
                  key={court.id}
                  value={court.id}
                  className="shrink-0"
                >
                  {court.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {visibleCourts.map((court) => (
              <TabsContent key={court.id} value={court.id} className="m-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {COURT_TYPE_LABELS[court.type]} · {court.open_time} a{" "}
                      {court.close_time}
                    </span>
                    <span>{court.slot_duration} min por turno</span>
                  </div>
                  <ul className="divide-y rounded-lg border bg-card">
                    {getCourtSlots(court).map((time) => {
                      const reservation = activeReservations.find(
                        (r) =>
                          r.court_id === court.id &&
                          reservationCoversSlot(r, time)
                      );
                      const isStart =
                        reservation && reservation.time === time;

                      if (reservation && !isStart) return null;

                      return (
                        <li key={time}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                              reservation
                                ? "bg-primary/10"
                                : "hover:bg-accent"
                            )}
                            onClick={() =>
                              reservation
                                ? openEditDialog(reservation)
                                : openCreateDialog(court.id, time)
                            }
                          >
                            <span className="font-medium">{time}</span>
                            {reservation ? (
                              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                <span className="truncate text-sm font-semibold text-primary">
                                  {reservation.customer_name}
                                </span>
                                <Badge
                                  variant={
                                    reservation.payment_status === "pagada"
                                      ? "default"
                                      : reservation.payment_status === "senada"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {
                                    PAYMENT_STATUS_LABELS[
                                      reservation.payment_status
                                    ]
                                  }
                                </Badge>
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Libre
                              </span>
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
            onCancelled={handleReservationSaved}
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
    </AuthGuard>
  );
}
