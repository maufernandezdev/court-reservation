"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RESERVATION_SELECT, type Reservation } from "@/lib/reservations";
import { useMembership } from "@/hooks/use-membership";
import { ensureFixedReservations } from "@/lib/series";

export function useReservations(date: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;

  const load = useCallback(async () => {
    setIsLoading(true);
    // Los turnos fijos se materializan al consultar la fecha.
    await ensureFixedReservations(supabase, clubId, date);
    const { data, error } = await supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .eq("club_id", clubId)
      .eq("date", date)
      .order("time", { ascending: true });

    if (error) {
      setError("No se pudieron cargar las reservas.");
    } else {
      setError("");
      setReservations((data ?? []) as Reservation[]);
    }
    setIsLoading(false);
  }, [supabase, clubId, date]);

  useEffect(() => {
    load();
  }, [load]);

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
