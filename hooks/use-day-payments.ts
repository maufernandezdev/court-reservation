"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DayPayment } from "@/lib/daily-overview";

/** Cobros (no liberados) de un conjunto de turnos, para totales de Hoy y la planilla. */
export function useDayPayments(reservationIds: string[]) {
  const [payments, setPayments] = useState<DayPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
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
      .in("reservation_id", ids)
      .eq("released", false);
    setPayments((data ?? []) as DayPayment[]);
    setIsLoading(false);
  }, [supabase, idsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { payments, isLoading, refetch: load };
}
