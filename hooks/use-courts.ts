"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Court } from "@/lib/courts";
import { queryCourts } from "@/lib/club-data";
import { useMembership } from "@/hooks/use-membership";
import { useClubDataSeed } from "@/components/club/club-data-provider";

/** Canchas activas del club. Si la página las trajo en el servidor, no se piden de nuevo. */
export function useCourts() {
  const clubId = useMembership().membership.club_id;
  const seed = useClubDataSeed(clubId)?.courts;
  const router = useRouter();

  const [courts, setCourts] = useState<Court[]>([]);
  const [isLoading, setIsLoading] = useState(!seed);
  const [error, setError] = useState("");

  const loadCourts = useCallback(async () => {
    const result = await queryCourts(createClient(), clubId);
    setError(result.error);
    if (!result.error) setCourts(result.courts);
    setIsLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (!seed) loadCourts();
  }, [seed, loadCourts]);

  if (seed) {
    return { courts: seed, isLoading: false, error: "", refetch: async () => router.refresh() };
  }
  return { courts, isLoading, error, refetch: loadCourts };
}
