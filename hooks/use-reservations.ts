"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reservation } from "@/lib/reservations";
import { queryReservations } from "@/lib/club-data";
import { useMembership } from "@/hooks/use-membership";

export type InitialReservations = { date: string; reservations: Reservation[]; error?: string };

/**
 * Turnos del club en una fecha. Con `initial` (traídos por el servidor para esa fecha)
 * no se vuelven a pedir al montar; al cambiar de fecha se piden desde el cliente.
 */
export function useReservations(date: string, initial?: InitialReservations) {
  const clubId = useMembership().membership.club_id;
  const hasInitial = initial?.date === date;
  const [reservations, setReservations] = useState<Reservation[]>(
    hasInitial ? initial.reservations : []
  );
  const [isLoading, setIsLoading] = useState(!hasInitial);
  const [error, setError] = useState(hasInitial ? (initial.error ?? "") : "");
  // Fecha cuyos datos ya están en el estado (evita pedir de nuevo lo que mandó el servidor).
  const loadedDate = useRef<string | null>(hasInitial ? date : null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await queryReservations(createClient(), clubId, date);
    setError(result.error);
    if (!result.error) setReservations(result.reservations);
    loadedDate.current = date;
    setIsLoading(false);
  }, [clubId, date]);

  useEffect(() => {
    if (loadedDate.current === date) return;
    load();
  }, [date, load]);

  const upsertLocal = useCallback(
    (reservation: Reservation) => {
      setReservations((prev) =>
        reservation.date === date
          ? [
              ...prev.filter((r) => r.id !== reservation.id),
              reservation,
            ]
              .sort((a, b) => a.time.localeCompare(b.time))
          : prev.filter((r) => r.id !== reservation.id)
      );
    },
    [date]
  );

  return {
    reservations,
    isLoading,
    error,
    refetch: load,
    upsertLocal,
  };
}
