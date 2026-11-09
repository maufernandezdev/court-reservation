"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Observa un media query. En el servidor y durante la hidratación da `false` (igual que
 * el HTML del servidor); justo después se re-renderiza con el valor real, en la misma
 * pasada que `useHydrated`, así no se ve un cuadro con la vista equivocada.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
