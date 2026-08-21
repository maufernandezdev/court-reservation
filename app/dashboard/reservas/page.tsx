"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COURTS,
  TIME_SLOTS,
  INITIAL_RESERVATIONS,
  type Reservation,
} from "@/lib/mocks/data";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, Trash2 } from "lucide-react";

const STORAGE_KEY = "club-reservations";
const STORAGE_VERSION_KEY = "club-reservations-version";
const CURRENT_STORAGE_VERSION = 2;

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

export default function ReservationsPage() {
  const [reservations, setReservations] =
    useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<
    string | null
  >(null);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDateKeyValue, setSelectedDateKeyValue] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReservationId, setDeletingReservationId] = useState<
    string | null
  >(null);

  const selectedDateKey = useMemo(
    () => formatDateKey(selectedDate),
    [selectedDate]
  );

  useEffect(() => {
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    const stored = localStorage.getItem(STORAGE_KEY);

    if (storedVersion !== String(CURRENT_STORAGE_VERSION)) {
      localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RESERVATIONS));
      setReservations(INITIAL_RESERVATIONS);
      setIsLoaded(true);
      return;
    }

    if (stored) {
      try {
        setReservations(JSON.parse(stored));
      } catch {
        setReservations(INITIAL_RESERVATIONS);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
    }
  }, [reservations, isLoaded]);

  const reservationsForDate = useMemo(
    () => reservations.filter((r) => r.date === selectedDateKey),
    [reservations, selectedDateKey]
  );

  const findReservation = (courtId: string, time: string) =>
    reservationsForDate.find((r) => r.courtId === courtId && r.time === time);

  const resetForm = () => {
    setEditingReservationId(null);
    setSelectedCourtId("");
    setSelectedTime("");
    setSelectedDateKeyValue("");
    setCustomerName("");
    setPhone("");
    setFormError("");
  };

  const openCreateDialog = (courtId: string, time: string) => {
    resetForm();
    setSelectedCourtId(courtId);
    setSelectedTime(time);
    setSelectedDateKeyValue(selectedDateKey);
    setDialogOpen(true);
  };

  const openEditDialog = (reservation: Reservation) => {
    resetForm();
    setEditingReservationId(reservation.id);
    setSelectedCourtId(reservation.courtId);
    setSelectedTime(reservation.time);
    setSelectedDateKeyValue(reservation.date);
    setCustomerName(reservation.customerName);
    setPhone(reservation.phone);
    setDialogOpen(true);
  };

  const handleCellClick = (courtId: string, time: string) => {
    const existing = findReservation(courtId, time);
    if (existing) {
      openEditDialog(existing);
      return;
    }
    openCreateDialog(courtId, time);
  };

  const isSlotOccupied = (
    courtId: string,
    time: string,
    date: string,
    excludeId?: string
  ): boolean => {
    return reservations.some(
      (r) =>
        r.courtId === courtId &&
        r.time === time &&
        r.date === date &&
        r.id !== excludeId
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!customerName.trim() || !selectedCourtId || !selectedTime || !selectedDateKeyValue) {
      setFormError("Completá todos los campos obligatorios.");
      return;
    }

    const targetDate = parseDateKey(selectedDateKeyValue);
    const targetDateKey = formatDateKey(targetDate);

    if (
      isSlotOccupied(
        selectedCourtId,
        selectedTime,
        targetDateKey,
        editingReservationId ?? undefined
      )
    ) {
      setFormError("Ese horario ya está reservado en la fecha seleccionada.");
      return;
    }

    if (editingReservationId) {
      setReservations((prev) =>
        prev.map((r) =>
          r.id === editingReservationId
            ? {
                ...r,
                courtId: selectedCourtId,
                time: selectedTime,
                date: targetDateKey,
                customerName: customerName.trim(),
                phone: phone.trim(),
              }
            : r
        )
      );
    } else {
      const newReservation: Reservation = {
        id: `r-${Date.now()}`,
        courtId: selectedCourtId,
        date: targetDateKey,
        time: selectedTime,
        customerName: customerName.trim(),
        phone: phone.trim(),
      };
      setReservations((prev) => [...prev, newReservation]);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDeleteClick = (reservationId: string) => {
    setDeletingReservationId(reservationId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingReservationId) return;
    setReservations((prev) =>
      prev.filter((r) => r.id !== deletingReservationId)
    );
    setDeleteDialogOpen(false);
    setDeletingReservationId(null);
    if (dialogOpen) {
      setDialogOpen(false);
      resetForm();
    }
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      setSelectedDate(parseDateKey(value));
    }
  };

  const dialogTitle = editingReservationId
    ? "Editar Reserva"
    : "Nueva Reserva";

  if (!isLoaded) {
    return (
      <AuthGuard>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
            <p className="text-muted-foreground">
              Vista diaria. Hacé clic en una celda para crear o editar una reserva.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-20 border-r">Hora</TableHead>
                {COURTS.map((court) => (
                  <TableHead key={court.id} className="min-w-[140px] text-center">
                    <div className="font-semibold">{court.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {court.sport}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIME_SLOTS.map((time) => (
                <TableRow key={time}>
                  <TableCell className="border-r font-medium">{time}</TableCell>
                  {COURTS.map((court) => {
                    const reservation = findReservation(court.id, time);
                    return (
                      <TableCell
                        key={`${court.id}-${time}`}
                        className={cn(
                          "h-16 cursor-pointer p-2 text-center transition-colors",
                          reservation
                            ? "bg-primary/10 text-primary-foreground hover:bg-primary/20"
                            : "hover:bg-accent"
                        )}
                        onClick={() => handleCellClick(court.id, time)}
                      >
                        {reservation ? (
                          <div className="flex h-full flex-col items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {reservation.customerName}
                            </span>
                            {reservation.phone && (
                              <span className="text-xs text-muted-foreground">
                                {reservation.phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Libre</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>
                  {editingReservationId
                    ? "Modificá los datos de la reserva."
                    : `Reserva para el ${formatDisplayDate(selectedDate)}.`}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {formError && (
                  <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="court">Cancha</Label>
                    <Select
                      value={selectedCourtId}
                      onValueChange={setSelectedCourtId}
                      required
                    >
                      <SelectTrigger id="court">
                        <SelectValue placeholder="Cancha" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURTS.map((court) => (
                          <SelectItem key={court.id} value={court.id}>
                            {court.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Horario</Label>
                    <Select
                      value={selectedTime}
                      onValueChange={setSelectedTime}
                      required
                    >
                      <SelectTrigger id="time">
                        <SelectValue placeholder="Horario" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDateKeyValue}
                    onChange={(e) => setSelectedDateKeyValue(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del socio / equipo</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Fernández / Casimiro"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono / DNI</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="3415123456"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div>
                  {editingReservationId && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDeleteClick(editingReservationId)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar Reserva</Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. ¿Estás seguro de que querés eliminar la reserva?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingReservationId(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthGuard>
  );
}
