import type { Court } from "@/lib/courts";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Valor de un turno según precio por hora y duración. */
export function getSlotPrice(
  court: Pick<Court, "price_per_hour">,
  durationMinutes: number
): number {
  return round2((court.price_per_hour * durationMinutes) / 60);
}

/** Monto de la seña según la configuración de la cancha (0 si está deshabilitada). */
export function getDepositAmount(
  court: Pick<
    Court,
    "price_per_hour" | "deposit_enabled" | "deposit_type" | "deposit_value"
  >,
  durationMinutes: number
): number {
  if (!court.deposit_enabled) return 0;
  const slotPrice = getSlotPrice(court, durationMinutes);
  const deposit =
    court.deposit_type === "fixed"
      ? court.deposit_value
      : round2((slotPrice * court.deposit_value) / 100);
  // La seña nunca supera el valor del turno.
  return Math.min(round2(deposit), slotPrice);
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
