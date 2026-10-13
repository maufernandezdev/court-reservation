"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pricesBySport, type SportPrices } from "@/lib/pricing";
import { useMembership } from "@/hooks/use-membership";

/** Precios por tipo de cancha del club activo (público, profe y seña). */
export function useSportPrices() {
  const [rows, setRows] = useState<SportPrices[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;

  const load = useCallback(async () => {
    const { data } = await supabase.from("sport_prices").select("*").eq("club_id", clubId);
    setRows((data ?? []) as SportPrices[]);
    setIsLoading(false);
  }, [supabase, clubId]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, prices: pricesBySport(rows), isLoading, refetch: load };
}
