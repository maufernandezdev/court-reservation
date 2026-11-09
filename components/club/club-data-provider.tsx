"use client";

import { createContext, useContext } from "react";
import type { Court } from "@/lib/courts";
import type { SportPrices } from "@/lib/pricing";
import type { LoadedClubSettings, Profe } from "@/lib/club-data";

/**
 * Datos del club que la página ya trajo en el servidor. Los hooks (`useCourts`,
 * `useClubSettings`, `useSportPrices`, `useProfes`) los toman de acá en vez de pedirlos
 * desde el navegador; si un dato no viene, el hook lo pide como antes. Cuando una
 * acción del servidor revalida la ruta, llegan los datos nuevos por props.
 */
export type ClubDataSeed = {
  clubId: string;
  courts?: Court[];
  settings?: LoadedClubSettings;
  sportPrices?: SportPrices[];
  profes?: Profe[];
};

const ClubDataContext = createContext<ClubDataSeed | null>(null);

export function ClubDataProvider({
  value,
  children,
}: {
  value: ClubDataSeed;
  children: React.ReactNode;
}) {
  return <ClubDataContext.Provider value={value}>{children}</ClubDataContext.Provider>;
}

/** Datos sembrados por el servidor para el club indicado (o null si no hay o son de otro club). */
export function useClubDataSeed(clubId: string): ClubDataSeed | null {
  const seed = useContext(ClubDataContext);
  return seed && seed.clubId === clubId ? seed : null;
}
