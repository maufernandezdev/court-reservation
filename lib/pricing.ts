import { z } from "zod";
import { COURT_TYPES, DEPOSIT_TYPES, type CourtType, type DepositType } from "@/lib/courts";
import type { ReservationKind } from "@/lib/reservations";

/** Precios de un tipo de cancha del club (tabla `sport_prices`). */
export type SportPrices = {
  club_id: string;
  sport: CourtType;
  public_price_per_hour: number;
  profe_price_per_hour: number;
  deposit_enabled: boolean;
  deposit_type: DepositType;
  deposit_value: number;
  updated_at: string;
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Precio por hora según el tipo de turno: profe usa el de profes; estándar y torneo, el del público. */
export function hourlyPrice(prices: SportPrices | undefined, kind: ReservationKind): number {
  if (!prices) return 0;
  return Number(kind === "profe" ? prices.profe_price_per_hour : prices.public_price_per_hour);
}

/**
 * Valor de un turno que todavía no existe (formulario, buscador): precio por hora
 * del tipo de cancha × duración. Lo mismo que fija el servidor al crearlo.
 */
export function quotePrice(
  prices: SportPrices | undefined,
  kind: ReservationKind,
  durationMinutes: number
): number {
  return round2((hourlyPrice(prices, kind) * durationMinutes) / 60);
}

/** Seña de un turno según la configuración del tipo de cancha, sobre su valor (0 si no pide). */
export function depositFor(prices: SportPrices | undefined, price: number): number {
  if (!prices?.deposit_enabled) return 0;
  const deposit =
    prices.deposit_type === "fixed"
      ? Number(prices.deposit_value)
      : round2((price * Number(prices.deposit_value)) / 100);
  // La seña nunca supera el valor del turno.
  return Math.min(round2(deposit), price);
}

/** Precios del club indexados por tipo de cancha. */
export function pricesBySport(rows: SportPrices[]): Partial<Record<CourtType, SportPrices>> {
  return Object.fromEntries(rows.map((row) => [row.sport, row]));
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Precios de un tipo de cancha (formulario de Precios en Canchas). */
export const sportPricesSchema = z
  .object({
    sport: z.enum(COURT_TYPES, { message: "Tipo de cancha inválido" }),
    public_price_per_hour: z.coerce
      .number({ message: "Ingresá un precio válido" })
      .min(0, "El precio no puede ser negativo"),
    profe_price_per_hour: z.coerce
      .number({ message: "Ingresá un precio válido" })
      .min(0, "El precio no puede ser negativo"),
    deposit_enabled: z.boolean(),
    deposit_type: z.enum(DEPOSIT_TYPES, { message: "Seleccioná el tipo de seña" }),
    deposit_value: z.coerce
      .number({ message: "Ingresá un valor de seña válido" })
      .min(0, "El valor de la seña no puede ser negativo"),
  })
  .refine((data) => !data.deposit_enabled || data.deposit_type !== "percent" || data.deposit_value <= 100, {
    message: "El porcentaje de seña no puede superar 100",
    path: ["deposit_value"],
  })
  .refine((data) => !data.deposit_enabled || data.deposit_value > 0, {
    message: "Ingresá el valor de la seña",
    path: ["deposit_value"],
  });

export type SportPricesInput = z.infer<typeof sportPricesSchema>;
