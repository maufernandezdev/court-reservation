"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DayPayment } from "@/lib/daily-overview";
import { idsKey, queryDayPayments } from "@/lib/club-data";
import { useMembership } from "@/hooks/use-membership";

export type InitialDayPayments = { idsKey: string; payments: DayPayment[] };

/**
 * Cobros (no liberados) de un conjunto de turnos, para totales de Hoy y la planilla.
 * Con `initial` (traídos por el servidor para esos mismos turnos) no se piden al montar.
 */
export function useDayPayments(reservationIds: string[], initial?: InitialDayPayments) {
  const clubId = useMembership().membership.club_id;
  // Clave estable para no recargar si llega el mismo conjunto en otro array.
  const key = idsKey(reservationIds);
  const hasInitial = initial?.idsKey === key;
  const [payments, setPayments] = useState<DayPayment[]>(hasInitial ? initial.payments : []);
  const [isLoading, setIsLoading] = useState(false);
  const loadedKey = useRef<string | null>(hasInitial ? key : null);

  const load = useCallback(async () => {
    const ids = key ? key.split(",") : [];
    loadedKey.current = key;
    if (ids.length === 0) {
      setPayments([]);
      return;
    }
    setIsLoading(true);
    setPayments(await queryDayPayments(createClient(), clubId, ids));
    setIsLoading(false);
  }, [clubId, key]);

  useEffect(() => {
    if (loadedKey.current === key) return;
    load();
  }, [key, load]);

  return { payments, isLoading, refetch: load };
}
