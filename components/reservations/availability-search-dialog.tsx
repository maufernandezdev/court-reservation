"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarSearch, Loader2 } from "lucide-react";
import type { Court, CourtType } from "@/lib/courts";
import { COURT_TYPES, COURT_TYPE_LABELS } from "@/lib/courts";
import { findFreeSlots } from "@/lib/availability";
import type { Reservation } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AvailabilitySearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courts: Court[];
  activeReservations: Reservation[];
  defaultDate: string;
  onSelect: (courtId: string, time: string, date: string) => void;
};

export function AvailabilitySearchDialog({
  open,
  onOpenChange,
  courts,
  activeReservations,
  defaultDate,
  onSelect,
}: AvailabilitySearchDialogProps) {
  const supabase = createClient();

  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<CourtType | "all">("all");
  const [otherDayReservations, setOtherDayReservations] = useState<
    Reservation[] | null
  >(null);
  const [isLoadingOtherDay, setIsLoadingOtherDay] = useState(false);

  // Al cambiar la fecha del buscador, trae las reservas de ese día.
  useEffect(() => {
    if (!open || date === defaultDate) {
      setOtherDayReservations(null);
      return;
    }

    let cancelled = false;
    setIsLoadingOtherDay(true);

    supabase
      .from("reservations")
      .select("*")
      .eq("date", date)
      .order("time", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setOtherDayReservations((data ?? []) as Reservation[]);
          setIsLoadingOtherDay(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, date, defaultDate, supabase]);

  const reservationsForSearch =
    date === defaultDate ? activeReservations : (otherDayReservations ?? []);

  const results = useMemo(
    () =>
      findFreeSlots(courts, reservationsForSearch, {
        from: from || undefined,
        to: to || undefined,
        type,
      }),
    [courts, reservationsForSearch, from, to, type]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarSearch className="h-5 w-5" />
            Buscar disponibilidad
          </DialogTitle>
          <DialogDescription>
            Busca turnos libres por fecha, franja horaria y tipo de cancha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-date">Fecha</Label>
              <Input
                id="search-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de cancha</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as CourtType | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {COURT_TYPES.map((courtType) => (
                    <SelectItem key={courtType} value={courtType}>
                      {COURT_TYPE_LABELS[courtType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-from">Desde (opcional)</Label>
              <Input
                id="search-from"
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-to">Hasta (opcional)</Label>
              <Input
                id="search-to"
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          {isLoadingOtherDay ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No hay franjas libres con esos filtros.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {results.map((slot, index) => (
                <li key={`${slot.court.id}-${slot.time}-${index}`}>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex w-full items-center justify-between"
                    onClick={() => {
                      onSelect(slot.court.id, slot.time, date);
                      onOpenChange(false);
                    }}
                  >
                    <span className="font-medium">{slot.time}</span>
                    <span className="text-muted-foreground">
                      {slot.court.name} · {COURT_TYPE_LABELS[slot.court.type]}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
