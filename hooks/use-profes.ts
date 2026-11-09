"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryProfes, type Profe } from "@/lib/club-data";
import { useMembership } from "@/hooks/use-membership";
import { useClubDataSeed } from "@/components/club/club-data-provider";

export type { Profe };

/**
 * Profesores del club activo (para turnos de profe y sus colores en la planilla). Si la
 * página los trajo en el servidor, todos los componentes usan esos sin pedirlos de nuevo.
 */
export function useProfes() {
  const clubId = useMembership().membership.club_id;
  const seed = useClubDataSeed(clubId)?.profes;
  const [profes, setProfes] = useState<Profe[]>([]);
  const [isLoading, setIsLoading] = useState(!seed);

  useEffect(() => {
    if (seed) return;
    let cancelled = false;
    queryProfes(createClient(), clubId).then((next) => {
      if (cancelled) return;
      setProfes(next);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [seed, clubId]);

  if (seed) return { profes: seed, isLoading: false };
  return { profes, isLoading };
}

/** Color de cada profe del club, por `user_id`. */
export function useProfeColors(): Map<string, string | null> {
  const { profes } = useProfes();
  return useMemo(() => new Map(profes.map((p) => [p.user_id, p.color])), [profes]);
}
