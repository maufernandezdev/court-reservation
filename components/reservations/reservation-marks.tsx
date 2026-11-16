import { CircleCheck, Repeat, Trophy } from "lucide-react";
import type { Reservation } from "@/lib/reservations";
import { cn } from "@/lib/utils";

/** Íconos de tipo: trofeo para torneo y repetición para turno fijo (con texto para lectores). */
export function ReservationMarks({
  reservation,
  className,
}: {
  reservation: Pick<Reservation, "kind" | "series_id" | "result_winner" | "result_score">;
  className?: string;
}) {
  const isTournament = reservation.kind === "torneo";
  const isFixed = !!reservation.series_id;
  const hasResult = isTournament && (!!reservation.result_winner || !!reservation.result_score);
  if (!isTournament && !isFixed) return null;
  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {isTournament && (
        <>
          <Trophy aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Torneo.</span>
        </>
      )}
      {hasResult && (
        <>
          <CircleCheck aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Partido con resultado.</span>
        </>
      )}
      {isFixed && (
        <>
          <Repeat aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Turno fijo.</span>
        </>
      )}
    </span>
  );
}
