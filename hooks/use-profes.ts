"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";

export type Profe = { user_id: string; name: string; color: string | null };

/** Profesores del club activo (para turnos de profe y sus colores en la planilla). */
export function useProfes() {
  const [profes, setProfes] = useState<Profe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const clubId = useMembership().membership.club_id;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("memberships")
      .select("user_id, full_name, email, color")
      .eq("club_id", clubId)
      .eq("role", "profesor")
      .then(({ data }) => {
        if (cancelled) return;
        setProfes(
          ((data ?? []) as { user_id: string; full_name: string; email: string; color: string | null }[])
            .map((m) => ({ user_id: m.user_id, name: m.full_name || m.email, color: m.color }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, clubId]);

  return { profes, isLoading };
}
