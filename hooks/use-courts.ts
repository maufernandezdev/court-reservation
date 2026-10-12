"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeTime } from "@/lib/availability";
import type { Court } from "@/lib/courts";
import { useMembership } from "@/hooks/use-membership";

export function useCourts() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;

  const loadCourts = useCallback(async () => {
    const { data, error } = await supabase
      .from("courts")
      .select("*")
      .eq("club_id", clubId)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (error) {
      setError("No se pudieron cargar las canchas.");
    } else {
      setError("");
      setCourts(
        (data ?? []).map((court) => ({
          ...(court as Court),
          open_time: normalizeTime(court.open_time as string),
          close_time: normalizeTime(court.close_time as string),
        }))
      );
    }
    setIsLoading(false);
  }, [supabase, clubId]);

  useEffect(() => {
    loadCourts();
  }, [loadCourts]);

  return { courts, isLoading, error, refetch: loadCourts };
}
