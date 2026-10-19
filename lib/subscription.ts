import type { SupabaseClient } from "@supabase/supabase-js";

/** Estado de la suscripción de un club, calculado en la base con las fechas. `none`: club sin suscripción. */
export type SubscriptionState = "trial" | "active" | "grace" | "expired" | "none";

export type BillingCycle = "monthly" | "yearly";

/** Respuesta de `club_subscription_status` (visible para cualquier miembro, sin montos). */
export type SubscriptionInfo = {
  state: SubscriptionState;
  status?: "trial" | "active" | "canceled";
  plan_code?: string;
  plan_name?: string;
  billing_cycle?: BillingCycle;
  trial_ends_on?: string;
  paid_until?: string | null;
  /** Último día incluido de la prueba o del período pagado. */
  ends_on?: string;
  grace_days?: number;
  /** Días hasta `ends_on` (0 = hoy es el último día; negativo = ya pasó). */
  days_left?: number;
  grace_days_left?: number | null;
  courts_used?: number;
  /** Null = sin tope. */
  courts_limit?: number | null;
  can_write: boolean;
};

export type Plan = {
  code: string;
  name: string;
  max_courts: number | null;
  monthly_price: number;
  yearly_price: number;
  sort_order: number;
};

export type SubscriptionPayment = {
  id: string;
  plan_code: string;
  amount: number;
  billing_cycle: BillingCycle;
  period_start: string;
  period_end: string;
  status: PaymentStatus;
  paid_at: string;
};

export type PaymentStatus = "approved" | "pending" | "rejected" | "refunded";

export const STATE_LABELS: Record<SubscriptionState, string> = {
  trial: "Prueba gratis",
  active: "Al día",
  grace: "En gracia",
  expired: "Vencida",
  none: "Sin suscripción",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  rejected: "Rechazado",
  refunded: "Devuelto",
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "mensual",
  yearly: "anual",
};

/** Bajada de cada plan en la pantalla de Suscripción. */
export const PLAN_DESCRIPTIONS: Record<string, string> = {
  inicial: "Para clubes chicos que están empezando.",
  club: "Para clubes en crecimiento con más actividad.",
  gran_club: "Para clubes grandes, sin tope de canchas.",
};

/** Cantidad de días antes del vencimiento desde la que el panel avisa. */
export const NOTICE_DAYS = 7;

/** Fecha `YYYY-MM-DD` (columna `date`) como `dd/mm/aaaa`, sin pasar por la zona horaria del navegador. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function pluralDays(n: number): string {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

/** Texto de las canchas incluidas en un plan. */
export function courtsLimitText(maxCourts: number | null): string {
  return maxCourts === null ? "Canchas ilimitadas" : `Hasta ${maxCourts} ${maxCourts === 1 ? "cancha" : "canchas"}`;
}

/** "1 a 3 canchas", "4 a 6 canchas", "7 o más canchas": el rango que cubre cada plan, ordenados por tope. */
export function courtsRangeText(plans: Plan[], plan: Plan): string {
  const sorted = [...plans].sort((a, b) => a.sort_order - b.sort_order);
  const index = sorted.findIndex((p) => p.code === plan.code);
  const from = index > 0 ? (sorted[index - 1].max_courts ?? 0) + 1 : 1;
  return plan.max_courts === null ? `${from} o más canchas` : `${from} a ${plan.max_courts} canchas`;
}

/** Estado de la suscripción del club. Si la consulta falla devuelve null: el panel sigue sin aviso. */
export async function fetchSubscriptionInfo(
  supabase: SupabaseClient,
  clubId: string
): Promise<SubscriptionInfo | null> {
  const { data, error } = await supabase.rpc("club_subscription_status", { p_club_id: clubId });
  if (error || !data) return null;
  return data as SubscriptionInfo;
}

export type SubscriptionNotice = {
  tone: "warning" | "destructive";
  title: string;
  message: string;
};

/**
 * Aviso del panel: prueba o período a 7 días o menos de vencer, club en gracia y club vencido.
 * Null cuando no hay nada que avisar. Solo el admin ve a dónde ir a regularizar.
 */
export function subscriptionNotice(info: SubscriptionInfo | null, isAdmin: boolean): SubscriptionNotice | null {
  if (!info) return null;
  const end = formatDate(info.ends_on);
  const who = isAdmin ? "" : " Avisale al administrador del club.";

  if (info.state === "trial" && (info.days_left ?? Infinity) <= NOTICE_DAYS) {
    return {
      tone: "warning",
      title: info.days_left === 0 ? "Tu prueba gratis termina hoy" : `Tu prueba gratis termina el ${end}`,
      message: `Para seguir usando la aplicación sin interrupciones, activá tu suscripción antes de esa fecha.${who}`,
    };
  }

  if (info.state === "active" && (info.days_left ?? Infinity) <= NOTICE_DAYS) {
    return {
      tone: "warning",
      title: info.days_left === 0 ? "Tu suscripción vence hoy" : `Tu suscripción vence el ${end}`,
      message: `Renovala para evitar interrupciones.${who}`,
    };
  }

  if (info.state === "grace") {
    const left = info.grace_days_left ?? 0;
    return {
      tone: "warning",
      title: `La suscripción venció el ${end}`,
      message: `Te ${left === 1 ? "queda" : "quedan"} ${pluralDays(left)} para regularizar el pago antes de que el club pase a solo lectura.${who}`,
    };
  }

  if (info.state === "expired") {
    return {
      tone: "destructive",
      title: "La suscripción está vencida: el club está en solo lectura",
      message: `Podés consultar toda la información, pero no crear ni modificar turnos, cobros, canchas, jugadores ni equipo hasta regularizar el pago.${who}`,
    };
  }

  return null;
}

/** Códigos que devuelve la base cuando la suscripción lo impide (solo lectura / límite de canchas del plan). */
const SUBSCRIPTION_ERROR_CODES = new Set(["55000", "54000"]);

/**
 * Mensaje para mostrar ante un error de la base: si lo causó la suscripción (club vencido o límite
 * de canchas) se muestra tal cual, que ya está redactado para el usuario; si no, el texto genérico.
 */
export function subscriptionMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  return error?.code && SUBSCRIPTION_ERROR_CODES.has(error.code) && error.message ? error.message : fallback;
}
