/**
 * Precio especial de un turno (migración 0033): de lista, sin cargo, por persona o monto fijo.
 * Sin dependencias de la app, para poder verificarlo con `node scripts/verify-special-pricing.ts`.
 */

export const PRICING_MODES = ["lista", "sin_cargo", "por_persona", "monto_fijo"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  lista: "De lista",
  sin_cargo: "Sin cargo",
  por_persona: "Por persona",
  monto_fijo: "Monto fijo",
};

/** Lo que se elige en el formulario. */
export type PricingInput = {
  pricing_mode: PricingMode;
  unit_price: number | null;
  expected_people: number | null;
  custom_price: number | null;
};

/** Precio del turno que se edita (null en un alta). */
export type ExistingPricing = {
  pricing_mode: PricingMode;
  price: number;
  unit_price: number | null;
  expected_people: number | null;
  /** Tiene cobros (no liberados). */
  has_payments: boolean;
  /** No cambiaron cancha, tipo, duración ni hora de inicio: el precio de lista se conserva. */
  slot_unchanged: boolean;
};

export type ResolvedPricing = {
  pricing_mode: PricingMode;
  /** Valor del turno. En "por_persona" es lo cobrado (arranca en 0). */
  price: number;
  unit_price: number | null;
  expected_people: number | null;
  /** Monto fijo (para guardarlo en el fijo). */
  custom_price: number | null;
  /** Estado de cobro a guardar; null = no se toca (o el de siempre en un alta). */
  payment_status: "pagada" | "pendiente" | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Precio que se guarda al crear o editar un turno. Solo el admin elige un modo distinto de
 * "lista"; para los demás, un turno especial conserva su precio y uno de lista se calcula como
 * siempre. `listPrice` se llama solo cuando hace falta el precio de lista.
 */
export async function resolvePricing(
  isAdmin: boolean,
  input: PricingInput,
  existing: ExistingPricing | null,
  listPrice: () => Promise<number>
): Promise<ResolvedPricing> {
  const keepListPrice = async () =>
    existing && existing.pricing_mode === "lista" && existing.slot_unchanged ? existing.price : await listPrice();

  if (!isAdmin) {
    if (existing && existing.pricing_mode !== "lista") {
      return {
        pricing_mode: existing.pricing_mode,
        price: existing.price,
        unit_price: existing.unit_price,
        expected_people: existing.expected_people,
        custom_price: existing.pricing_mode === "monto_fijo" ? existing.price : null,
        payment_status: null,
      };
    }
    return {
      pricing_mode: "lista",
      price: await keepListPrice(),
      unit_price: null,
      expected_people: null,
      custom_price: null,
      payment_status: null,
    };
  }

  const mode = input.pricing_mode;
  const modeChanged = !!existing && existing.pricing_mode !== mode;
  if (modeChanged && existing!.has_payments) {
    throw new Error("Este turno ya tiene cobros: no se puede cambiar cómo se cobra.");
  }

  let price: number;
  let unitPrice: number | null = null;
  let expectedPeople: number | null = null;
  let customPrice: number | null = null;

  switch (mode) {
    case "lista":
      price = await keepListPrice();
      break;
    case "sin_cargo":
      price = 0;
      break;
    case "monto_fijo":
      if (input.custom_price === null || !Number.isFinite(input.custom_price) || input.custom_price < 0) {
        throw new Error("Poné el monto del turno.");
      }
      price = round2(input.custom_price);
      customPrice = price;
      break;
    case "por_persona":
      if (input.unit_price === null || !Number.isFinite(input.unit_price) || input.unit_price <= 0) {
        throw new Error("Poné el precio por persona.");
      }
      unitPrice = round2(input.unit_price);
      expectedPeople = input.expected_people;
      // Lo cobrado hasta ahora (si ya era por persona) o nada.
      price = existing?.pricing_mode === "por_persona" ? existing.price : 0;
      break;
  }

  const paymentStatus: ResolvedPricing["payment_status"] = !existing
    ? mode === "sin_cargo"
      ? "pagada"
      : null
    : modeChanged
      ? mode === "sin_cargo"
        ? "pagada"
        : "pendiente"
      : null;

  return {
    pricing_mode: mode,
    price,
    unit_price: unitPrice,
    expected_people: expectedPeople,
    custom_price: customPrice,
    payment_status: paymentStatus,
  };
}
