"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import { queryApprovalRules } from "@/lib/club-data";
import type { ApprovalRule } from "@/lib/approval";
import { useClubDataSeed } from "@/components/club/club-data-provider";

/** Horarios con confirmación del club activo (sembrados por el servidor o pedidos al abrir). */
export function useApprovalRules(): ApprovalRule[] {
  const clubId = useMembership().membership.club_id;
  const seed = useClubDataSeed(clubId)?.approvalRules;
  const [rules, setRules] = useState<ApprovalRule[]>(seed ?? []);

  useEffect(() => {
    if (seed) return;
    let cancelled = false;
    queryApprovalRules(createClient(), clubId).then((next) => {
      if (!cancelled) setRules(next);
    });
    return () => {
      cancelled = true;
    };
  }, [seed, clubId]);

  return seed ?? rules;
}
