"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reservation } from "@/lib/reservations";
import { queryReservations } from "@/lib/club-data";
import { useMembership } from "@/hooks/use-membership";

export type InitialReservations = { date: string; reservations: Reservation[]; error?: string };

/** Mientras carga otra fecha: siempre el mismo arreglo, para no disparar memos ni efectos. */
const NO_RESERVATIONS: Reservation[] = [];

type Loaded = { date: string | null; reservations: Reservation[]; error: string };

/**
 * Turnos del club en una fecha. Con `initial` (traídos por el servidor para esa fecha)
 * no se vuelven a pedir al montar; al cambiar de fecha se piden desde el cliente.
 *
 * `isLoading` sale de comparar la fecha pedida con la cargada, así que es verdadero en el
 * mismo render en que cambia la fecha: nunca se muestran los turnos de otro día. Si se
 * cambia de fecha varias veces seguidas, una respuesta que llega tarde se descarta.
 */
export function useReservations(date: string, initial?: InitialReservations) {
  const clubId = useMembership().membership.club_id;
  const [loaded, setLoaded] = useState<Loaded>(() =>
    initial?.date === date
      ? { date, reservations: initial.reservations, error: initial.error ?? "" }
      : { date: null, reservations: [], error: "" }
  );
  // Fecha que se está mirando ahora (para descartar respuestas de una fecha anterior).
  const currentDate = useRef(date);
  useEffect(() => {
    currentDate.current = date;
  }, [date]);

  const load = useCallback(async () => {
    const result = await queryReservations(createClient(), clubId, date);
    if (currentDate.current !== date) return;
    setLoaded((prev) => ({
      date,
      // Si falla, se conserva lo que ya había de esa fecha.
      reservations: result.error ? (prev.date === date ? prev.reservations : []) : result.reservations,
      error: result.error,
    }));
  }, [clubId, date]);

  useEffect(() => {
    if (loaded.date === date) return;
    load();
    // Solo cuando cambia la fecha (o el club): `loaded` cambia como resultado de esta carga.
  }, [date, load]);

  const upsertLocal = useCallback(
    (reservation: Reservation) => {
      setLoaded((prev) =>
        prev.date !== date
          ? prev
          : {
              ...prev,
              reservations:
                reservation.date === date
                  ? [...prev.reservations.filter((r) => r.id !== reservation.id), reservation].sort((a, b) =>
                      a.time.localeCompare(b.time)
                    )
                  : prev.reservations.filter((r) => r.id !== reservation.id),
            }
      );
    },
    [date]
  );

  const isCurrent = loaded.date === date;
  return {
    reservations: isCurrent ? loaded.reservations : NO_RESERVATIONS,
    isLoading: !isCurrent,
    error: isCurrent ? loaded.error : "",
    refetch: load,
    upsertLocal,
  };
}
