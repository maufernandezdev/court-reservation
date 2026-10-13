"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import type { ClubSettings } from "@/lib/reservations";

const DEFAULTS = { cancel_window_hours: 24, late_penalty_percent: 50, tournament_duration_minutes: 90 };

/** Políticas del club activo (con los valores por defecto si todavía no se configuraron). */
export function useClubSettings() {
  const [settings, setSettings] = useState<Pick<ClubSettings, keyof typeof DEFAULTS>>(DEFAULTS);
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("settings")
      .select("cancel_window_hours, late_penalty_percent, tournament_duration_minutes")
      .eq("club_id", clubId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setSettings({ ...DEFAULTS, ...data });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, clubId]);

  return settings;
}
