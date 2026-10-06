"use client";

import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import { COURT_TYPE_LABELS, type Court } from "@/lib/courts";
import type { Reservation } from "@/lib/reservations";
import {
  getCourtSlots,
  minutesToTime,
  rangesOverlap,
  timeToMinutes,
} from "@/lib/availability";
import {
  RESERVATION_TONE_LABELS,
  toneClasses,
  toneFor,
} from "@/lib/reservation-tone";
import { cn } from "@/lib/utils";

/** Alto de una fila de 30 minutos, en px. */
const ROW = 28;
const HEADER_ROW = 1;

type ScheduleGridProps = {
  courts: Court[];
  /** Turnos activos del día visible. */
  reservations: Reservation[];
  /** Minutos del día actual si la fecha visible es hoy (línea de "ahora"); null si no. */
  nowMinutes: number | null;
  selectedId: string | null;
  onSelect: (reservation: Reservation) => void;
  onCreate: (courtId: string, time: string) => void;
};

/**
 * Planilla de escritorio: canchas en columnas, filas de 30 min, un bloque por
 * turno que ocupa toda su duración (ver specs/reservation-sheet).
 */
export function ScheduleGrid({
  courts,
  reservations,
  nowMinutes,
  selectedId,
  onSelect,
  onCreate,
}: ScheduleGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const start = Math.min(...courts.map((c) => timeToMinutes(c.open_time)));
  const end = Math.max(...courts.map((c) => timeToMinutes(c.close_time)));
  const rows = Math.max(1, Math.ceil((end - start) / 30));
  const rowOf = (minutes: number) => Math.floor((minutes - start) / 30) + HEADER_ROW + 1;

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let t = Math.ceil(start / 60) * 60; t < end; t += 60) list.push(t);
    return list;
  }, [start, end]);

  // Al abrir, llevar la vista cerca de la hora actual.
  useEffect(() => {
    if (nowMinutes === null || !scrollRef.current) return;
    const top = ((nowMinutes - start) / 30) * ROW - ROW * 4;
    scrollRef.current.scrollTop = Math.max(0, top);
    // Solo al montar o cambiar de día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMinutes === null, start]);

  const nowInRange = nowMinutes !== null && nowMinutes >= start && nowMinutes <= end;

  return (
    <div
      ref={scrollRef}
      className="max-h-[calc(100vh-15rem)] min-h-[420px] overflow-auto rounded-2xl border bg-card"
    >
      <div
        className="relative grid pb-2"
        style={{
          gridTemplateColumns: `4rem repeat(${courts.length}, minmax(9.5rem, 1fr))`,
          gridTemplateRows: `auto repeat(${rows}, ${ROW}px)`,
          minWidth: `calc(4rem + ${courts.length} * 9.5rem)`,
        }}
      >
        {/* Esquina */}
        <div
          className="sticky top-0 left-0 z-30 border-b bg-card"
          style={{ gridColumn: 1, gridRow: 1 }}
        />

        {courts.map((court, i) => {
          const col = i + 2;
          const open = timeToMinutes(court.open_time);
          const close = timeToMinutes(court.close_time);
          const mine = reservations.filter((r) => r.court_id === court.id);
          const freeSlots = getCourtSlots(court).filter(
            (time) =>
              !mine.some((r) =>
                rangesOverlap(
                  timeToMinutes(time),
                  court.slot_duration,
                  timeToMinutes(r.time),
                  r.duration_minutes
                )
              ) &&
              (nowMinutes === null || timeToMinutes(time) + court.slot_duration > nowMinutes)
          );

          return (
            <div key={court.id} className="contents">
              <div
                className="sticky top-0 z-20 flex flex-col gap-0.5 border-b border-l bg-card px-3 py-3"
                style={{ gridColumn: col, gridRow: 1 }}
              >
                <strong className="text-[15px]">{court.name}</strong>
                <span className="font-mono text-xs text-muted-foreground uppercase">
                  {COURT_TYPE_LABELS[court.type]} · {court.slot_duration} min
                </span>
              </div>

              {/* Fondo de la columna con líneas de hora */}
              <div
                aria-hidden="true"
                className="border-l"
                style={{
                  gridColumn: col,
                  gridRow: `2 / span ${rows}`,
                  backgroundImage: `repeating-linear-gradient(to bottom, hsl(var(--muted)) 0 1px, transparent 1px ${ROW * 2}px)`,
                }}
              />

              {/* Fuera de horario */}
              {open > start && (
                <div
                  aria-hidden="true"
                  className="bg-hatch opacity-60"
                  style={{ gridColumn: col, gridRow: `2 / ${rowOf(open)}` }}
                />
              )}
              {close < end && (
                <div
                  aria-hidden="true"
                  className="bg-hatch opacity-60"
                  style={{ gridColumn: col, gridRow: `${rowOf(close)} / ${rows + 2}` }}
                />
              )}

              {/* Libres y turnos intercalados por horario: así el orden de tabulación sigue el día. */}
              {[
                ...freeSlots.map((time) => ({ kind: "free" as const, start: timeToMinutes(time), time })),
                ...mine.map((r) => ({ kind: "reservation" as const, start: timeToMinutes(r.time), r })),
              ]
                .sort((a, b) => a.start - b.start)
                .map((item) => {
                  if (item.kind === "free") {
                    const time = item.time;
                    return (
                      <button
                        key={`free-${court.id}-${time}`}
                        type="button"
                        onClick={() => onCreate(court.id, time)}
                        aria-label={`${court.name}, ${time}, libre. Reservar`}
                        className="group z-[1] m-0.5 flex items-start justify-start rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-line"
                        style={{
                          gridColumn: col,
                          gridRow: `${rowOf(item.start)} / span ${court.slot_duration / 30}`,
                        }}
                      >
                        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Plus className="size-3.5" />
                          {time}
                        </span>
                      </button>
                    );
                  }
                  const r = item.r;
                  const tone = toneFor(r);
                  const endTime = minutesToTime(item.start + r.duration_minutes);
                  const selected = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelect(r)}
                      aria-pressed={selected}
                      aria-label={`${r.customer_name}, ${r.time} a ${endTime}, ${RESERVATION_TONE_LABELS[tone]}`}
                      className={cn(
                        "z-10 m-0.5 flex min-w-0 flex-col items-start gap-0.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line",
                        toneClasses(tone),
                        selected &&
                          "shadow-[0_6px_16px_rgb(16_20_24/0.18)] outline-3 outline-offset-2 outline-line"
                      )}
                      style={{
                        gridColumn: col,
                        gridRow: `${rowOf(item.start)} / span ${Math.max(1, Math.round(r.duration_minutes / 30))}`,
                      }}
                    >
                      <span className="w-full truncate text-sm leading-tight font-semibold">
                        {r.customer_name}
                      </span>
                      <span className="font-mono text-xs leading-tight opacity-85">
                        {r.time} – {endTime}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}

        {/* Columna de horas */}
        {hours.map((t) => (
          <span
            key={t}
            className="sticky left-0 z-[15] bg-card pt-1 pr-2.5 text-right font-mono text-xs text-muted-foreground"
            style={{ gridColumn: 1, gridRow: `${rowOf(t)} / span 2` }}
          >
            {minutesToTime(t)}
          </span>
        ))}

        {/* Línea de "ahora" */}
        {nowInRange && (
          <div
            aria-hidden="true"
            className="pointer-events-none relative z-[25]"
            style={{ gridColumn: "1 / -1", gridRow: `2 / span ${rows}` }}
          >
            <div
              className="absolute inset-x-0 flex items-center"
              style={{ top: ((nowMinutes! - start) / 30) * ROW }}
            >
              <span className="sticky left-1 ml-1 rounded bg-destructive px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                {minutesToTime(nowMinutes!)}
              </span>
              <span className="h-0.5 flex-1 bg-destructive" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
