"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import { DEFAULT_CLUB_HOURS, normalizeTime } from "@/lib/availability";
import { DEFAULT_NIGHT_STARTS_AT } from "@/lib/pricing";
import type { ClubSettings } from "@/lib/reservations";

const DEFAULTS = {
  cancel_window_hours: 24,
  late_penalty_percent: 50,
  tournament_duration_minutes: 90,
  night_starts_at: DEFAULT_NIGHT_STARTS_AT,
  open_time: DEFAULT_CLUB_HOURS.open_time,
  close_time: DEFAULT_CLUB_HOURS.close_time,
};

type LoadedSettings = Pick<ClubSettings, keyof typeof DEFAULTS>;

/** Últimas políticas leídas de cada club: al volver a abrir un diálogo ya arrancan con los datos reales. */
const cache = new Map<string, LoadedSettings>();

/**
 * Políticas del club activo (con los valores por defecto si todavía no se configuraron).
 * `loaded` es falso hasta que llegan los datos reales: antes de eso el horario del club es el de
 * referencia y no conviene calcular nada con él.
 */
export function useClubSettings() {
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;
  const [settings, setSettings] = useState<LoadedSettings>(() => cache.get(clubId) ?? DEFAULTS);
  const [loaded, setLoaded] = useState(() => cache.has(clubId));

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("settings")
      .select(
        "cancel_window_hours, late_penalty_percent, tournament_duration_minutes, night_starts_at, open_time, close_time"
      )
      .eq("club_id", clubId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const next: LoadedSettings = data
          ? {
              ...DEFAULTS,
              ...data,
              night_starts_at: normalizeTime(data.night_starts_at),
              open_time: normalizeTime(data.open_time),
              close_time: normalizeTime(data.close_time),
            }
          : DEFAULTS;
        cache.set(clubId, next);
        setSettings(next);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, clubId]);

  return { ...settings, loaded };
}
