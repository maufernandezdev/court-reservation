"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import { DEFAULT_CLUB_SETTINGS, queryClubSettings, type LoadedClubSettings } from "@/lib/club-data";
import { useClubDataSeed } from "@/components/club/club-data-provider";

/** Últimas políticas leídas de cada club: al volver a abrir un diálogo ya arrancan con los datos reales. */
const cache = new Map<string, LoadedClubSettings>();

/**
 * Políticas del club activo (con los valores por defecto si todavía no se configuraron).
 * Si la página las trajo en el servidor, se usan esas. `loaded` es falso hasta que llegan
 * los datos reales: antes de eso el horario del club es el de referencia y no conviene
 * calcular nada con él.
 */
export function useClubSettings() {
  const clubId = useMembership().membership.club_id;
  const seed = useClubDataSeed(clubId)?.settings;
  const [settings, setSettings] = useState<LoadedClubSettings>(
    () => cache.get(clubId) ?? DEFAULT_CLUB_SETTINGS
  );
  const [loaded, setLoaded] = useState(() => cache.has(clubId));

  useEffect(() => {
    if (seed) {
      cache.set(clubId, seed);
      return;
    }
    let cancelled = false;
    queryClubSettings(createClient(), clubId).then((next) => {
      if (cancelled) return;
      cache.set(clubId, next);
      setSettings(next);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [seed, clubId]);

  if (seed) return { ...seed, loaded: true };
  return { ...settings, loaded };
}
