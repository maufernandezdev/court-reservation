"use client";

import { createContext, useContext } from "react";
import type { Membership } from "@/lib/roles";

type ActiveClubValue = {
  /** Membresía en el club activo (la resuelve el layout del panel en el servidor). */
  membership: Membership;
  /** Todas las membresías de la persona, para el selector de club. */
  memberships: Membership[];
};

const ActiveClubContext = createContext<ActiveClubValue | null>(null);

export function ActiveClubProvider({
  membership,
  memberships,
  children,
}: ActiveClubValue & { children: React.ReactNode }) {
  return (
    <ActiveClubContext.Provider value={{ membership, memberships }}>
      {children}
    </ActiveClubContext.Provider>
  );
}

export function useActiveClub(): ActiveClubValue {
  const value = useContext(ActiveClubContext);
  if (!value) {
    throw new Error("useActiveClub se usa dentro del panel (ActiveClubProvider).");
  }
  return value;
}
