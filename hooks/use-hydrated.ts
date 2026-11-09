"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `false` en el servidor y durante la hidratación; `true` después (y de entrada en
 * navegaciones del lado del cliente). Para textos que dependen de la hora o la zona
 * horaria del dispositivo y no pueden coincidir con el HTML del servidor.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
