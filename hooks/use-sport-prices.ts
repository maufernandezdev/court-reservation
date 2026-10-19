"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pricesBySport, type SportPrices } from "@/lib/pricing";
import { useMembership } from "@/hooks/use-membership";

/** Últimos precios leídos de cada club: al abrir un panel o un formulario ya arrancan con datos y no esperan. */
const cache = new Map<string, SportPrices[]>();

/** Precios por tipo de cancha del club activo (público, profe y seña). */
export function useSportPrices() {
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;
  const [rows, setRows] = useState<SportPrices[]>(() => cache.get(clubId) ?? []);
  const [isLoading, setIsLoading] = useState(() => !cache.has(clubId));

  const load = useCallback(async () => {
    const { data } = await supabase.from("sport_prices").select("*").eq("club_id", clubId);
    const next = (data ?? []) as SportPrices[];
    cache.set(clubId, next);
    setRows(next);
    setIsLoading(false);
  }, [supabase, clubId]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, prices: pricesBySport(rows), isLoading, refetch: load };
}
