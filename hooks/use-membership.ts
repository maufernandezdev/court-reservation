"use client";

import { useActiveClub } from "@/components/shell/active-club-provider";

/**
 * Membresía del usuario en el club activo. La resuelve el layout del panel en el
 * servidor (cookie `club_activo`), así que nunca está "cargando".
 */
export function useMembership() {
  const { membership } = useActiveClub();
  return { membership, isLoading: false };
}
