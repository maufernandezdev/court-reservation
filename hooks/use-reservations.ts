"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reservation } from "@/lib/reservations";
import { useMembership } from "@/hooks/use-membership";

export function useReservations(date: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
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
