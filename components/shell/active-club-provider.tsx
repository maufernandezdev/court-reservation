"use client";

import { createContext, useContext } from "react";
import type { Membership } from "@/lib/roles";

type ActiveClubValue = {
  /** Membresía en el club activo (la resuelve el layout del panel en el servidor). */
  membership: Membership;
  /** Todas las membresías de la persona, para el selector de club. */
  memberships: Membership[];
  /** Turnos por confirmar (solo para el admin; 0 para el resto): contador en "Hoy". */
  pendingApprovals?: number;
};

const ActiveClubContext = createContext<ActiveClubValue | null>(null);

export function ActiveClubProvider({
  membership,
  memberships,
  pendingApprovals = 0,
  children,
}: ActiveClubValue & { children: React.ReactNode }) {
  return (
    <ActiveClubContext.Provider value={{ membership, memberships, pendingApprovals }}>
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
