import { z } from "zod";
import {
  PAYMENT_METHODS,
  VISIBLE_PAYMENT_METHODS,
  type Payment,
  type PaymentMethod,
} from "@/lib/reservations";

/** Movimiento de la caja: entra o sale plata que no es un cobro de turno. */
export const CASH_MOVEMENT_TYPES = ["in", "out"] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_IN_CATEGORIES = ["accesorio", "otro_ingreso"] as const;
export const CASH_OUT_CATEGORIES = [
  "liquidacion_profe",
  "empleado",
  "proveedor",
  "gasto_general",
  "retiro",
] as const;
export type CashInCategory = (typeof CASH_IN_CATEGORIES)[number];
export type CashOutCategory = (typeof CASH_OUT_CATEGORIES)[number];
export type CashCategory = CashInCategory | CashOutCategory;

export const CASH_CATEGORY_LABELS: Record<CashCategory, string> = {
  accesorio: "Accesorio",
  otro_ingreso: "Otro ingreso",
  liquidacion_profe: "Liquidación de profe",
  empleado: "Empleado",
  proveedor: "Proveedor",
  gasto_general: "Gasto general",
  retiro: "Retiro",
};

export type CashMovement = {
  id: string;
  club_id: string;
  date: string;
  type: CashMovementType;
  category: CashCategory;
  concept: string;
  counterparty: string;
  quantity: number | null;
  amount: number;
  method: PaymentMethod;
  note: string;
  voided: boolean;
  voided_at: string | null;
  voided_by: string | null;
  created_by: string | null;
  created_at: string;
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const moneySchema = z.coerce
  .number({ message: "Ingresá un monto válido" })
  .positive("El monto tiene que ser mayor a 0")
  .max(100_000_000, "El monto es demasiado alto")
  .refine((value) => Number.isInteger(value * 100), "Hasta dos decimales");

/** Venta de un accesorio u otro ingreso (lo carga admin u operador). */
export const cashSaleSchema = z.object({
  date: dateSchema,
  category: z.enum(CASH_IN_CATEGORIES, { message: "Elegí qué se vendió" }),
  concept: z.string().trim().min(1, "Escribí qué se vendió").max(120, "Hasta 120 caracteres"),
  /** Precio por unidad. */
  unit_price: moneySchema,
  /** Cantidad (1 si no se cambia). */
  quantity: z.coerce
    .number({ message: "Ingresá una cantidad válida" })
    .int("La cantidad va sin decimales")
    .min(1, "Mínimo 1")
    .max(999, "Máximo 999"),
  method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
});
export type CashSaleInput = z.infer<typeof cashSaleSchema>;

/** Salidas que tienen que decir a quién se le pagó (el reporte mensual las agrupa por persona o proveedor). */
export const COUNTERPARTY_REQUIRED: ReadonlySet<CashOutCategory> = new Set(["liquidacion_profe", "empleado", "proveedor"]);

/** Producto del catálogo: al vender se elige y el precio viene cargado. */
export type Product = { id: string; name: string; price: number; active: boolean };

export const productSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre del producto").max(80, "Hasta 80 caracteres"),
  price: moneySchema,
});
export type ProductInput = z.infer<typeof productSchema>;

/** A quién se le paga en las salidas (tenga o no usuario en la app). */
export const PAYEE_KINDS = ["empleado", "profe", "proveedor"] as const;
export type PayeeKind = (typeof PAYEE_KINDS)[number];
export const PAYEE_KIND_LABELS: Record<PayeeKind, string> = {
  empleado: "Empleado",
  profe: "Profe",
  proveedor: "Proveedor",
};
export type Payee = { id: string; name: string; kind: PayeeKind; active: boolean };

export const payeeSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre").max(80, "Hasta 80 caracteres"),
  kind: z.enum(PAYEE_KINDS, { message: "Elegí si es empleado, profe o proveedor" }),
});
export type PayeeInput = z.infer<typeof payeeSchema>;

/** Qué tipo de destinatario se sugiere para cada categoría de salida (null: todos). */
export const PAYEE_KIND_BY_CATEGORY: Record<CashOutCategory, PayeeKind | null> = {
  liquidacion_profe: "profe",
  empleado: "empleado",
  proveedor: "proveedor",
  gasto_general: null,
  retiro: null,
};

/**
 * Categorías que se ofrecen al registrar una salida. "Liquidación de profe" queda solo para las
 * salidas viejas: ahora es el profe quien le paga al club (Liquidación de profes).
 */
export const NEW_CASH_OUT_CATEGORIES = CASH_OUT_CATEGORIES.filter((c) => c !== "liquidacion_profe");

/** Salida de plata (solo admin): liquidaciones, empleados, proveedores, gastos y retiros. */
export const cashExpenseSchema = z.object({
  date: dateSchema,
  category: z.enum(CASH_OUT_CATEGORIES, { message: "Elegí el tipo de salida" }),
  counterparty: z.string().trim().max(120, "Hasta 120 caracteres"),
  amount: moneySchema,
  method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
  note: z.string().trim().max(200, "Hasta 200 caracteres"),
}).superRefine((value, ctx) => {
  if (COUNTERPARTY_REQUIRED.has(value.category) && !value.counterparty) {
    ctx.addIssue({ code: "custom", path: ["counterparty"], message: "Elegí o escribí a quién se le paga" });
  }
});
export type CashExpenseInput = z.infer<typeof cashExpenseSchema>;

/** Cambio inicial del día (solo admin). */
export const cashOpeningSchema = z.object({
  date: dateSchema,
  amount: z.coerce
    .number({ message: "Ingresá un monto válido" })
    .min(0, "El cambio no puede ser negativo")
    .max(100_000_000, "El monto es demasiado alto"),
});
export type CashOpeningInput = z.infer<typeof cashOpeningSchema>;

/** Monto por medio de pago, con todos los medios en 0. */
export type ByMethod = Record<PaymentMethod, number>;

function emptyByMethod(): ByMethod {
  return Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as ByMethod;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type CashDaySummary = {
  opening: number;
  /** Cobros de turnos (señas y pagos; el saldo a favor aplicado no es plata nueva). */
  reservationIncome: ByMethod;
  /** Ventas y otros ingresos cargados en la caja (sin anulados). */
  movementIncome: ByMethod;
  /** Salidas (sin anuladas). */
  expenses: ByMethod;
  /** Todo lo que entró, por medio. */
  income: ByMethod;
  incomeTotal: number;
  expenseTotal: number;
  /** Cambio + entradas en efectivo − salidas en efectivo. */
  cashOnHand: number;
  /** Entradas por MP − salidas por MP. */
  mercadoPagoNet: number;
};

/**
 * Cuentas de la caja de un día. La usan Caja y el cierre del día de Reportes,
 * así los dos muestran los mismos números.
 */
export function summarizeCashDay(input: {
  opening: number;
  payments: Pick<Payment, "kind" | "amount" | "method">[];
  movements: Pick<CashMovement, "type" | "amount" | "method" | "voided">[];
}): CashDaySummary {
  const reservationIncome = emptyByMethod();
  const movementIncome = emptyByMethod();
  const expenses = emptyByMethod();

  for (const p of input.payments) {
    if (p.kind === "saldo") continue;
    reservationIncome[p.method] = round2(reservationIncome[p.method] + Number(p.amount));
  }
  for (const m of input.movements) {
    if (m.voided) continue;
    const bucket = m.type === "in" ? movementIncome : expenses;
    bucket[m.method] = round2(bucket[m.method] + Number(m.amount));
  }

  const income = emptyByMethod();
  for (const method of PAYMENT_METHODS) {
    income[method] = round2(reservationIncome[method] + movementIncome[method]);
  }
  const sum = (byMethod: ByMethod) => round2(Object.values(byMethod).reduce((a, b) => a + b, 0));

  return {
    opening: Number(input.opening) || 0,
    reservationIncome,
    movementIncome,
    expenses,
    income,
    incomeTotal: sum(income),
    expenseTotal: sum(expenses),
    cashOnHand: round2((Number(input.opening) || 0) + income.efectivo - expenses.efectivo),
    mercadoPagoNet: round2(income.mercado_pago - expenses.mercado_pago),
  };
}

/** El club opera en Argentina (UTC-3, sin horario de verano). */
export const CLUB_OFFSET = "-03:00";

export function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Rango [desde, hasta) en timestamptz de un día del club, para filtrar `created_at`. */
export function dayRange(key: string): { from: string; to: string } {
  return { from: `${key}T00:00:00${CLUB_OFFSET}`, to: `${nextDayKey(key)}T00:00:00${CLUB_OFFSET}` };
}
