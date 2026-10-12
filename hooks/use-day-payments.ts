"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DayPayment } from "@/lib/daily-overview";
import { useMembership } from "@/hooks/use-membership";

/** Cobros (no liberados) de un conjunto de turnos, para totales de Hoy y la planilla. */
export function useDayPayments(reservationIds: string[]) {
  const [payments, setPayments] = useState<DayPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;
  // Clave estable para no recargar si llega el mismo conjunto en otro array.
  const idsKey = [...reservationIds].sort().join(",");

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setPayments([]);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("reservation_id, amount, released")
      .eq("club_id", clubId)
      .in("reservation_id", ids)
      .eq("released", false);
    setPayments((data ?? []) as DayPayment[]);
    setIsLoading(false);
  }, [supabase, clubId, idsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { payments, isLoading, refetch: load };
}
