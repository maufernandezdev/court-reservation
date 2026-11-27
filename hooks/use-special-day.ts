"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import { querySpecialDay, type SpecialDay } from "@/lib/special-days";

/** Día especial (feriado) de una fecha del club activo, o null si es un día común. */
export function useSpecialDay(date: string) {
  const clubId = useMembership().membership.club_id;
  const [loaded, setLoaded] = useState<{ date: string | null; day: SpecialDay | null }>({ date: null, day: null });

  const load = useCallback(async () => {
    if (!date) return;
    const day = await querySpecialDay(createClient(), clubId, date);
    setLoaded({ date, day });
  }, [clubId, date]);

  useEffect(() => {
    load();
  }, [load]);

  return { specialDay: loaded.date === date ? loaded.day : null, refetch: load };
}
