"use client";

import { useEffect, useState } from "react";
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

const STORAGE_KEY = "club-reservations";

export default function ReservationsPage() {
  const [reservations, setReservations] =
    useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
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

  const findReservation = (courtId: string, time: string) =>
    reservations.find((r) => r.courtId === courtId && r.time === time);

  const handleCellClick = (courtId: string, time: string) => {
    const existing = findReservation(courtId, time);
    if (existing) return;

    setSelectedCourtId(courtId);
    setSelectedTime(time);
    setCustomerName("");
    setPhone("");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !selectedCourtId || !selectedTime) return;

    const existing = findReservation(selectedCourtId, selectedTime);
    if (existing) return;

    const newReservation: Reservation = {
      id: `r-${Date.now()}`,
      courtId: selectedCourtId,
      time: selectedTime,
      customerName: customerName.trim(),
      phone: phone.trim(),
    };

    setReservations((prev) => [...prev, newReservation]);
    setDialogOpen(false);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
            <p className="text-muted-foreground">
              Hacé clic en un horario libre para crear una reserva.
            </p>
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
                            ? "bg-primary/10 text-primary-foreground cursor-not-allowed"
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
                <DialogTitle>Nueva Reserva</DialogTitle>
                <DialogDescription>
                  Completá los datos del socio para reservar el turno seleccionado.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar Reserva</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
