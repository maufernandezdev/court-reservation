import { Repeat } from "lucide-react";
import { RESERVATION_TONE_LABELS, toneFor, type ReservationTone } from "@/lib/reservation-tone";
import { sortedParticipants, type Reservation } from "@/lib/reservations";
import { minutesToTime, timeToMinutes } from "@/lib/availability";
import { Badge } from "@/components/ui/badge";
import { TurnActionsMenu } from "@/components/my-turns/turn-actions-menu";
import { cn } from "@/lib/utils";

const TONE_BADGE: Record<ReservationTone, "paid" | "deposit" | "pending" | "cancelled" | "fixed"> = {
  paid: "paid",
  deposit: "deposit",
  pending: "pending",
  cancelled: "cancelled",
  fixed: "fixed",
};

/**
 * Un turno de profe en "Mis turnos": horario, cancha, alumnos y estado. La primera persona de un turno
 * de profe es el propio profe, así que los alumnos son las demás.
 */
export function TurnCard({
  turn,
  courtName,
  showDate,
  compact,
  canManage,
}: {
  turn: Reservation;
  courtName: string;
  /** Muestra la fecha corta (por ejemplo "19/10") antes del horario. */
  showDate?: boolean;
  compact?: boolean;
  /** Muestra el menú de tres puntos con editar y cancelar (turnos activos que todavía no pasaron). */
  canManage?: boolean;
}) {
  const tone = toneFor(turn);
  const end = minutesToTime(timeToMinutes(turn.time) + turn.duration_minutes);
  const students = sortedParticipants(turn).slice(1).map((p) => p.name);
  const [, month, day] = turn.date.split("-");

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card",
        compact ? "p-3" : "p-4",
        turn.status === "cancelled" && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {showDate && <span className="font-mono text-sm text-muted-foreground">{`${day}/${month}`}</span>}
          <strong className={cn("font-mono", compact ? "text-sm" : "text-base", turn.status === "cancelled" && "line-through")}>
            {turn.time} – {end}
          </strong>
          <span className="text-sm text-muted-foreground">{courtName}</span>
        </div>
        {/* Los márgenes negativos compensan el tamaño del botón para que no agrande la fila. */}
        {canManage && (
          <span className="-mt-1 -mr-1.5 shrink-0">
            <TurnActionsMenu turn={turn} />
          </span>
        )}
      </div>
      <p className={cn("text-pretty", compact ? "text-[13px]" : "text-[15px]", students.length === 0 && "text-muted-foreground")}>
        {students.length > 0 ? students.join(", ") : "Sin alumnos cargados"}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={TONE_BADGE[tone]}>{RESERVATION_TONE_LABELS[tone]}</Badge>
        {turn.series_id && (
          <Badge variant="outline" className="gap-1">
            <Repeat />
            Fijo
          </Badge>
        )}
      </div>
    </article>
  );
}
