import { z } from "zod";
import { COURT_TYPES, DEPOSIT_TYPES, type CourtType, type DepositType } from "@/lib/courts";
import { normalizeTime, timeToMinutes } from "@/lib/availability";
import type { ReservationKind } from "@/lib/reservations";

/** Hora desde la que rige el precio de noche si el club no configuró otra. */
export const DEFAULT_NIGHT_STARTS_AT = "18:00";

/** Precios de un tipo de cancha del club (tabla `sport_prices`). */
export type SportPrices = {
  club_id: string;
  sport: CourtType;
  public_price_per_hour: number;
  profe_price_per_hour: number;
  public_night_price_per_hour: number;
  profe_night_price_per_hour: number;
  public_deposit_enabled: boolean;
  public_deposit_type: DepositType;
  public_deposit_value: number;
  profe_deposit_enabled: boolean;
  profe_deposit_type: DepositType;
  profe_deposit_value: number;
  updated_at: string;
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * ¿El turno que empieza a `start` cae en el horario de noche? Se mira solo la hora de
 * inicio: un turno que empieza antes se cobra todo de día, aunque termine de noche.
 */
export function isNight(start: string, nightStartsAt: string): boolean {
  return timeToMinutes(start) >= timeToMinutes(normalizeTime(nightStartsAt));
}

/**
 * Precio por hora según el tipo de turno y el momento: profe usa los precios de profes;
 * estándar y torneo, los del público. De noche se usan los precios de noche; si no hay uno cargado (0), el de día.
 */
export function hourlyPrice(
  prices: SportPrices | undefined,
  kind: ReservationKind,
  night: boolean
): number {
  if (!prices) return 0;
  const [day, nightPrice] =
    kind === "profe"
      ? [prices.profe_price_per_hour, prices.profe_night_price_per_hour]
      : [prices.public_price_per_hour, prices.public_night_price_per_hour];
  // Sin precio de noche cargado (0) se cobra el de día: el club que no distingue no tiene que cargarlo dos veces.
  return Number(night && Number(nightPrice) > 0 ? nightPrice : day);
}

/** Valor de un turno de esa duración en el horario de día o de noche indicado. */
export function quotePriceFor(
  prices: SportPrices | undefined,
  kind: ReservationKind,
  durationMinutes: number,
  night: boolean
): number {
  return round2((hourlyPrice(prices, kind, night) * durationMinutes) / 60);
}

/**
 * Valor de un turno que todavía no existe (formulario, buscador): precio por hora
 * del tipo de cancha según su hora de inicio × duración. Lo mismo que fija el servidor
 * al crearlo y la base al generar los turnos fijos.
 */
export function quotePrice(
  prices: SportPrices | undefined,
  kind: ReservationKind,
  durationMinutes: number,
  start: string,
  nightStartsAt: string
): number {
  return quotePriceFor(prices, kind, durationMinutes, isNight(start, nightStartsAt));
}

/**
 * Seña de un turno según la configuración del tipo de cancha, sobre su valor (0 si no pide).
 * Los turnos de profe usan la seña de profes; los estándar y de torneo, la del público.
 */
export function depositFor(prices: SportPrices | undefined, kind: ReservationKind, price: number): number {
  if (!prices) return 0;
  const [enabled, type, value] =
    kind === "profe"
      ? [prices.profe_deposit_enabled, prices.profe_deposit_type, prices.profe_deposit_value]
      : [prices.public_deposit_enabled, prices.public_deposit_type, prices.public_deposit_value];
  if (!enabled) return 0;
  const deposit = type === "fixed" ? Number(value) : round2((price * Number(value)) / 100);
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
    public_night_price_per_hour: z.coerce
      .number({ message: "Ingresá un precio válido" })
      .min(0, "El precio no puede ser negativo"),
    profe_night_price_per_hour: z.coerce
      .number({ message: "Ingresá un precio válido" })
      .min(0, "El precio no puede ser negativo"),
    public_deposit_enabled: z.boolean(),
    public_deposit_type: z.enum(DEPOSIT_TYPES, { message: "Seleccioná el tipo de seña" }),
    public_deposit_value: z.coerce
      .number({ message: "Ingresá un valor de seña válido" })
      .min(0, "El valor de la seña no puede ser negativo"),
    profe_deposit_enabled: z.boolean(),
    profe_deposit_type: z.enum(DEPOSIT_TYPES, { message: "Seleccioná el tipo de seña" }),
    profe_deposit_value: z.coerce
      .number({ message: "Ingresá un valor de seña válido" })
      .min(0, "El valor de la seña no puede ser negativo"),
  })
  .superRefine((data, ctx) => {
    for (const audience of ["public", "profe"] as const) {
      if (!data[`${audience}_deposit_enabled`]) continue;
      const path = [`${audience}_deposit_value`];
      const value = data[`${audience}_deposit_value`];
      if (data[`${audience}_deposit_type`] === "percent" && value > 100) {
        ctx.addIssue({ code: "custom", message: "El porcentaje de seña no puede superar 100", path });
      } else if (value <= 0) {
        ctx.addIssue({ code: "custom", message: "Ingresá el valor de la seña", path });
      }
    }
  });

export type SportPricesInput = z.infer<typeof sportPricesSchema>;

/** Horario desde el que rige la noche en todo el club (formulario de Precios). */
export const nightStartSchema = z.object({
  night_starts_at: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Elegí un horario válido"),
});

export type NightStartInput = z.infer<typeof nightStartSchema>;
