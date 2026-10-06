"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import type { Court, CourtType } from "@/lib/courts";
import { COURT_TYPES, COURT_TYPE_LABELS } from "@/lib/courts";
import {
  buildAvailabilityMessage,
  findFreeSlots,
  minutesToTime,
} from "@/lib/availability";
import type { Reservation } from "@/lib/reservations";
import { formatMoney, getSlotPrice } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { dateKey, minutesOfDay, useNow } from "@/hooks/use-now";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type AvailabilitySearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courts: Court[];
  activeReservations: Reservation[];
  defaultDate: string;
  onSelect: (courtId: string, time: string, date: string) => void;
};

const MESSAGE_LIMIT = 8;
const FROM_OPTIONS = ["18:00", "19:00", "20:00", "21:00"];

function addDaysKey(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string): string {
  if (key === todayKey) return "hoy";
  if (key === tomorrowKey) return "mañana";
  const [y, m, d] = key.split("-").map(Number);
  return `el ${new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" })}`;
}

/** Buscador rápido "¿Hay cancha?": día, deporte y hora desde; copia el resultado para WhatsApp. */
export function AvailabilitySearchDialog({
  open,
  onOpenChange,
  courts,
  activeReservations,
  defaultDate,
  onSelect,
}: AvailabilitySearchDialogProps) {
  const supabase = createClient();
  const now = useNow();
  const todayKey = dateKey(now);
  const tomorrowKey = addDaysKey(now, 1);

  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState<string>("now");
  const [type, setType] = useState<CourtType | "all">("all");
  const [otherDayReservations, setOtherDayReservations] = useState<Reservation[] | null>(null);
  const [isLoadingOtherDay, setIsLoadingOtherDay] = useState(false);

  // Al abrir, arranca en el día que se está mirando.
  useEffect(() => {
    if (open) setDate(defaultDate);
  }, [open, defaultDate]);

  // Al cambiar la fecha del buscador, trae las reservas activas de ese día.
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
      .eq("status", "active")
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

  const isToday = date === todayKey;
  // "Ahora" = próxima media hora; en otro día, desde la apertura.
  const nowFrom = minutesToTime(Math.ceil((minutesOfDay(now) + 1) / 30) * 30);
  const effectiveFrom =
    from === "now" ? (isToday ? nowFrom : undefined) : isToday && from < nowFrom ? nowFrom : from;

  const results = useMemo(
    () =>
      findFreeSlots(courts, reservationsForSearch, {
        from: effectiveFrom,
        type,
      }),
    [courts, reservationsForSearch, effectiveFrom, type]
  );

  const availableTypes = COURT_TYPES.filter((t) => courts.some((c) => c.type === t));
  const sportLabel = type === "all" ? undefined : COURT_TYPE_LABELS[type].toLowerCase();
  const message = buildAvailabilityMessage({
    dayLabel: dayLabel(date, todayKey, tomorrowKey),
    detail: sportLabel,
    slots: results.slice(0, MESSAGE_LIMIT).map((slot) => ({
      time: slot.time,
      label: slot.court.name,
    })),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copiado", { description: "Pegalo en WhatsApp para responder la consulta." });
    } catch {
      toast.error("No se pudo copiar. Probá de nuevo.");
    }
  };

  const dayOptions = [
    { key: todayKey, label: "Hoy" },
    { key: tomorrowKey, label: "Mañana" },
    ...[2, 3].map((n) => {
      const key = addDaysKey(now, n);
      const [y, m, d] = key.split("-").map(Number);
      const label = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
        weekday: "short",
        day: "numeric",
      });
      return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
    }),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-5 overflow-y-auto max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em] font-stretch-[125%]">
            ¿Hay cancha?
          </DialogTitle>
          <DialogDescription>
            Para responder una llamada o un mensaje en segundos.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-mono text-xs font-semibold text-muted-foreground">DÍA</legend>
          <div className="flex flex-wrap items-center gap-1.5">
            <ToggleGroup
              type="single"
              variant="chip"
              spacing={1.5}
              value={dayOptions.some((d) => d.key === date) ? date : ""}
              onValueChange={(v) => v && setDate(v)}
              aria-label="Día"
              className="flex-wrap"
            >
              {dayOptions.map((d) => (
                <ToggleGroupItem key={d.key} value={d.key} size="lg">
                  {d.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Otra fecha"
              className="w-auto"
            />
          </div>
        </fieldset>

        {availableTypes.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-mono text-xs font-semibold text-muted-foreground">DEPORTE</legend>
            <ToggleGroup
              type="single"
              variant="segmented"
              spacing={1}
              value={type}
              onValueChange={(v) => v && setType(v as CourtType | "all")}
              aria-label="Deporte"
              className="grid w-full rounded-lg bg-muted p-1"
              style={{ gridTemplateColumns: `repeat(${availableTypes.length + 1}, minmax(0, 1fr))` }}
            >
              <ToggleGroupItem value="all" className="h-10 w-full">
                Todos
              </ToggleGroupItem>
              {availableTypes.map((t) => (
                <ToggleGroupItem key={t} value={t} className="h-10 w-full">
                  {COURT_TYPE_LABELS[t]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-mono text-xs font-semibold text-muted-foreground">DESDE</legend>
          <ToggleGroup
            type="single"
            variant="chip"
            spacing={1.5}
            value={from}
            onValueChange={(v) => v && setFrom(v)}
            aria-label="Desde"
            className="flex-wrap"
          >
            <ToggleGroupItem value="now" size="lg">
              {isToday ? "Ahora" : "Apertura"}
            </ToggleGroupItem>
            {FROM_OPTIONS.map((t) => (
              <ToggleGroupItem key={t} value={t} size="lg" className="font-mono">
                {t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>

        <section aria-labelledby="search-results" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 id="search-results" className="text-[17px] font-bold">
              {isLoadingOtherDay
                ? "Buscando…"
                : results.length === 0
                  ? "Sin lugares"
                  : `${results.length} ${results.length === 1 ? "lugar libre" : "lugares libres"}`}
            </h3>
          </div>
          {isLoadingOtherDay ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="rounded-xl border-[1.5px] border-dashed border-input p-4 text-center text-[15px] text-muted-foreground">
              No queda nada libre desde ese horario. Probá otro día.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {results.map((slot) => (
                <li
                  key={`${slot.court.id}-${slot.time}`}
                  className="flex items-center gap-3 rounded-xl border bg-card py-2 pr-2 pl-3.5"
                >
                  <strong className="w-14 font-mono text-lg">{slot.time}</strong>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="text-[15px]">{slot.court.name}</strong>
                    <span className="text-[13px] text-muted-foreground">
                      {COURT_TYPE_LABELS[slot.court.type]} · {slot.court.slot_duration} min ·{" "}
                      {formatMoney(getSlotPrice(slot.court, slot.court.slot_duration))}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className="h-11"
                    onClick={() => {
                      onSelect(slot.court.id, slot.time, date);
                      onOpenChange(false);
                    }}
                  >
                    Reservar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="wa-preview" className="flex flex-col gap-2">
          <h3 id="wa-preview" className="font-mono text-xs font-semibold text-muted-foreground">
            ASÍ SE COPIA PARA WHATSAPP
          </h3>
          <p className="rounded-[14px_14px_14px_4px] border bg-card px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </section>

        <Button
          size="lg"
          onClick={copy}
          disabled={isLoadingOtherDay}
          className="bg-ball text-ball-foreground hover:bg-ball/90"
        >
          <MessageCircle />
          Copiar disponibilidad
        </Button>
      </DialogContent>
    </Dialog>
  );
}
