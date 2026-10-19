"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { COURT_TYPE_LABELS, type Court } from "@/lib/courts";
import { START_STEP_MINUTES, minutesToTime, timeToMinutes, type ClubHours } from "@/lib/availability";
import {
  RESERVATION_TONE_LABELS,
  toneFor,
  reservationLook,
  reservationTitle,
} from "@/lib/reservation-tone";
import { RESERVATION_KIND_LABELS, type Reservation } from "@/lib/reservations";
import { ReservationMarks } from "@/components/reservations/reservation-marks";
import { useProfeColors } from "@/hooks/use-profes";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Row =
  | { kind: "now" }
  | { kind: "free"; start: number; end: number }
  | { kind: "past"; start: number }
  | { kind: "reservation"; reservation: Reservation };

type MobileScheduleProps = {
  courts: Court[];
  /** Turnos activos del día visible. */
  reservations: Reservation[];
  selectedDateKey: string;
  todayKey: string;
  /** Horario del club. */
  hours: ClubHours;
  /** Minutos del día actual si la fecha visible es hoy; null si no. */
  nowMinutes: number | null;
  onSelectDate: (key: string) => void;
  onSelect: (reservation: Reservation) => void;
  onCreate: (courtId: string, time: string) => void;
};

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Ayer, hoy y los próximos 5 días (más el día elegido si queda afuera). */
function dayStrip(todayKey: string, selectedKey: string): string[] {
  const today = keyToDate(todayKey);
  const keys: string[] = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    keys.push(toKey(d));
  }
  if (!keys.includes(selectedKey)) keys.push(selectedKey);
  return keys.sort();
}

/** Turnos y huecos de una cancha, desde `from` hasta el cierre. */
function buildRows(
  court: Court,
  reservations: Reservation[],
  from: number,
  nowMinutes: number | null,
  hours: ClubHours
): Row[] {
  const close = timeToMinutes(hours.close_time);
  const mine = reservations
    .filter((r) => r.court_id === court.id)
    .map((r) => ({ r, s: timeToMinutes(r.time), e: timeToMinutes(r.time) + r.duration_minutes }))
    .filter(({ e }) => e > from)
    .sort((a, b) => a.s - b.s);

  const rows: Row[] = [];
  let nowPlaced = nowMinutes === null;
  const placeNow = (t: number) => {
    if (!nowPlaced && nowMinutes !== null && t > nowMinutes) {
      rows.push({ kind: "now" });
      nowPlaced = true;
    }
  };
  // Un hueco libre es una sola fila: desde su comienzo (o, hoy, la próxima media hora) hasta el siguiente turno.
  const pushFree = (startAt: number, endAt: number) => {
    placeNow(startAt);
    if (nowMinutes !== null && endAt <= nowMinutes) {
      rows.push({ kind: "past", start: startAt });
      return;
    }
    const start =
      nowMinutes !== null && startAt < nowMinutes
        ? Math.ceil(nowMinutes / START_STEP_MINUTES) * START_STEP_MINUTES
        : startAt;
    if (endAt - start < START_STEP_MINUTES) return;
    placeNow(start);
    rows.push({ kind: "free", start, end: endAt });
  };

  let cursor = from;
  for (const { r, s, e } of mine) {
    if (s > cursor) pushFree(cursor, s);
    placeNow(s);
    rows.push({ kind: "reservation", reservation: r });
    cursor = Math.max(cursor, e);
  }
  if (cursor < close) pushFree(cursor, close);
  return rows;
}

/** Planilla del celular: una cancha por vez, desde cerca de la hora actual. */
export function MobileSchedule({
  courts,
  reservations,
  selectedDateKey,
  todayKey,
  hours,
  nowMinutes,
  onSelectDate,
  onSelect,
  onCreate,
}: MobileScheduleProps) {
  const profeColors = useProfeColors();
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [fromOpening, setFromOpening] = useState(false);

  const court = courts.find((c) => c.id === courtId) ?? courts[0];
  if (!court) return null;

  const open = timeToMinutes(hours.open_time);
  // Por defecto arranca una hora antes de ahora (alineado a la media hora).
  const nearNow =
    nowMinutes === null
      ? open
      : Math.max(
          open,
          open + Math.floor((nowMinutes - 60 - open) / START_STEP_MINUTES) * START_STEP_MINUTES
        );
  const from = fromOpening ? open : nearNow;
  const rows = buildRows(court, reservations, from, nowMinutes, hours);

  return (
    // pb-20: que el último turno pueda subir por encima del botón flotante.
    <div className="flex flex-col gap-3 pb-20">
      <div
        role="group"
        aria-label="Día"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
      >
        {dayStrip(todayKey, selectedDateKey).map((key) => {
          const d = keyToDate(key);
          const active = key === selectedDateKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectDate(key)}
              className={cn(
                "flex h-[58px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-line",
                active ? "border-ink bg-ink text-ball" : "bg-card hover:bg-accent"
              )}
            >
              <span className="text-xs opacity-80 first-letter:uppercase">
                {key === todayKey ? "Hoy" : d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}
              </span>
              <strong className="font-mono text-[17px]">{d.getDate()}</strong>
            </button>
          );
        })}
      </div>

      <ToggleGroup
        type="single"
        variant="chip"
        spacing={1.5}
        value={court.id}
        onValueChange={(v) => {
          if (v) {
            setCourtId(v);
            setFromOpening(false);
          }
        }}
        aria-label="Cancha"
        className="-mx-4 w-auto max-w-none flex-nowrap overflow-x-auto px-4 sm:-mx-6 sm:px-6"
      >
        {courts.map((c) => (
          <ToggleGroupItem key={c.id} value={c.id} size="lg" className="shrink-0">
            {c.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-baseline justify-between px-0.5">
        <strong className="text-[15px]">{court.name}</strong>
        <span className="font-mono text-xs text-muted-foreground uppercase">
          {COURT_TYPE_LABELS[court.type]}
        </span>
      </div>

      {!fromOpening && from > open && (
        <Button
          variant="outline"
          className="border-dashed font-normal text-muted-foreground"
          onClick={() => setFromOpening(true)}
        >
          Ver desde las {hours.open_time}
        </Button>
      )}

      <ol className="flex flex-col gap-2" aria-label={`Turnos de ${court.name}`}>
        {rows.length === 0 && (
          <li className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
            No hay turnos para mostrar.
          </li>
        )}
        {rows.map((row, i) => {
          if (row.kind === "now") {
            return (
              <li key={`now-${i}`} aria-hidden="true" className="my-0.5 flex items-center gap-2">
                <span className="rounded bg-destructive px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                  {minutesToTime(nowMinutes!)}
                </span>
                <span className="h-0.5 flex-1 bg-destructive" />
              </li>
            );
          }
          if (row.kind === "past") {
            return (
              <li
                key={`past-${row.start}`}
                className="flex min-h-10 items-center gap-3 rounded-xl bg-muted px-3.5 text-muted-foreground"
              >
                <span className="w-13 font-mono text-sm">{minutesToTime(row.start)}</span>
                <span className="text-[13px]">Sin uso</span>
              </li>
            );
          }
          if (row.kind === "free") {
            const time = minutesToTime(row.start);
            return (
              <li
                key={`free-${row.start}`}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input bg-card py-1 pr-1 pl-3.5"
              >
                <span className="w-13 font-mono text-[15px] font-semibold">{time}</span>
                <span className="flex-1 text-sm text-muted-foreground">
                  Libre hasta las {minutesToTime(row.end)}
                </span>
                <Button size="sm" className="h-11" onClick={() => onCreate(court.id, time)}>
                  Reservar
                </Button>
              </li>
            );
          }
          const r = row.reservation;
          const tone = toneFor(r);
          const look = reservationLook(r, r.profe_user_id ? profeColors.get(r.profe_user_id) : null);
          const end = minutesToTime(timeToMinutes(r.time) + r.duration_minutes);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className={cn(
                  "flex min-h-[60px] w-full items-center gap-3 rounded-xl py-2 pr-3 pl-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line",
                  look.className
                )}
                style={look.style}
              >
                <span className="w-13 font-mono text-[15px] font-semibold">{r.time}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <strong className="min-w-0 truncate text-[15px]">{reservationTitle(r)}</strong>
                    <ReservationMarks reservation={r} />
                  </span>
                  <span className="text-[13px] opacity-85">
                    {r.time}–{end}
                    {r.kind !== "standard" ? ` · ${RESERVATION_KIND_LABELS[r.kind]}` : ""} ·{" "}
                    {RESERVATION_TONE_LABELS[tone]}
                  </span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 opacity-70" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Botón flotante "Nuevo turno" del celular (arriba de la barra inferior). */
export function NewReservationFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nuevo turno"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 flex size-[60px] items-center justify-center rounded-[18px] bg-ball text-ball-foreground shadow-[0_10px_24px_rgb(16_20_24/0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line lg:hidden"
    >
      <Plus className="size-[26px]" strokeWidth={2.4} />
    </button>
  );
}
