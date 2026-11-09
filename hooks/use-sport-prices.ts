"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pricesBySport, type SportPrices } from "@/lib/pricing";
import { querySportPrices } from "@/lib/club-data";
import { useMembership } from "@/hooks/use-membership";
import { useClubDataSeed } from "@/components/club/club-data-provider";

/** Últimos precios leídos de cada club: al abrir un panel o un formulario ya arrancan con datos y no esperan. */
const cache = new Map<string, SportPrices[]>();

/** Precios por tipo de cancha del club activo (público, profe y seña). Si la página los trajo en el servidor, se usan esos. */
export function useSportPrices() {
  const clubId = useMembership().membership.club_id;
  const seed = useClubDataSeed(clubId)?.sportPrices;
  const router = useRouter();
  const [rows, setRows] = useState<SportPrices[]>(() => cache.get(clubId) ?? []);
  const [isLoading, setIsLoading] = useState(() => !cache.has(clubId));

  const load = useCallback(async () => {
    const next = await querySportPrices(createClient(), clubId);
    cache.set(clubId, next);
    setRows(next);
    setIsLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (seed) cache.set(clubId, seed);
    else load();
  }, [seed, clubId, load]);

  if (seed) {
    return { rows: seed, prices: pricesBySport(seed), isLoading: false, refetch: async () => router.refresh() };
  }
  return { rows, prices: pricesBySport(rows), isLoading, refetch: load };
}
