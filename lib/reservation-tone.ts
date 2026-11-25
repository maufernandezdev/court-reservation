import type { CSSProperties } from "react";
import {
  PAYMENT_METHOD_SHORT,
  sortedParticipants,
  type PaymentMethod,
  type Reservation,
} from "@/lib/reservations";
import { formatMoney } from "@/lib/pricing";
import { FALLBACK_PROFE_COLOR } from "@/lib/profe-colors";

/**
 * Tono visual de un turno. Única fuente de verdad para planilla, Hoy, celular y
 * detalle (ver specs/visual-identity). Los tonos se distinguen por luminosidad,
 * no solo por color. `fixed` (azul de marca) se usa para los turnos de torneo; los fijos
 * se marcan con un ícono (ver `reservationLook`).
 */
export const RESERVATION_TONES = [
  "paid",
  "deposit",
  "pending",
  "cancelled",
  "fixed",
] as const;
export type ReservationTone = (typeof RESERVATION_TONES)[number];

export const RESERVATION_TONE_LABELS: Record<ReservationTone, string> = {
  paid: "Pagada",
  deposit: "Señada",
  pending: "Pendiente",
  cancelled: "Cancelada",
  fixed: "Torneo",
};

export function toneFor(
  reservation: Pick<Reservation, "status" | "payment_status">
): ReservationTone {
  if (reservation.status === "cancelled") return "cancelled";
  if (reservation.payment_status === "pagada") return "paid";
  if (reservation.payment_status === "senada") return "deposit";
  return "pending";
}

/** Estado del cobro en masculino ("el turno"): "Pendiente", "Señado", "Pagado". */
const PAYMENT_STATE_SHORT: Record<Reservation["payment_status"], string> = {
  pendiente: "Pendiente",
  senada: "Señado",
  pagada: "Pagado",
};

/** Medio del último cobro (no liberado) de cada turno. */
export function lastMethodByReservation(
  payments: { reservation_id: string; released: boolean; method?: PaymentMethod; created_at?: string }[]
): Map<string, PaymentMethod> {
  const latest = new Map<string, { at: string; method: PaymentMethod }>();
  for (const p of payments) {
    if (p.released || !p.method) continue;
    const at = p.created_at ?? "";
    const prev = latest.get(p.reservation_id);
    if (!prev || at >= prev.at) latest.set(p.reservation_id, { at, method: p.method });
  }
  return new Map([...latest].map(([id, v]) => [id, v.method]));
}

/**
 * Resumen del cobro de un turno para la planilla: "$18.000 · Pagado · MP".
 * Sin precio a la vista (organizador de torneos) solo queda el texto vacío.
 */
export function paymentSummary(
  reservation: Pick<Reservation, "payment_status"> & {
    price?: number | null;
    status?: Reservation["status"];
    pricing_mode?: Reservation["pricing_mode"] | null;
    unit_price?: number | null;
    expected_people?: number | null;
    closed_at?: string | null;
  },
  lastMethod?: PaymentMethod | null
): string {
  const noPrice = reservation.price === undefined || reservation.price === null;
  if (reservation.status === "pending_approval") {
    return noPrice ? "Por confirmar" : `Por confirmar · ${formatMoney(Number(reservation.price))}`;
  }
  if (noPrice) return "";
  if (reservation.pricing_mode === "sin_cargo") return "Sin cargo";
  if (reservation.pricing_mode === "por_persona") {
    const collected = Number(reservation.price);
    if (reservation.closed_at) {
      const people = reservation.expected_people;
      return ["Cerrada", people ? `${people} ${people === 1 ? "persona" : "personas"}` : null, formatMoney(collected)]
        .filter(Boolean)
        .join(" · ");
    }
    const unit = reservation.unit_price === undefined || reservation.unit_price === null ? null : Number(reservation.unit_price);
    return [unit !== null ? `${formatMoney(unit)} c/u` : "Por persona", collected > 0 ? `cobrado ${formatMoney(collected)}` : "Abierta"].join(" · ");
  }
  const parts = [formatMoney(Number(reservation.price)), PAYMENT_STATE_SHORT[reservation.payment_status]];
  if (lastMethod && reservation.payment_status !== "pendiente") parts.push(PAYMENT_METHOD_SHORT[lastMethod]);
  return parts.join(" · ");
}

/** Clases de fondo, borde y texto para bloques y tarjetas de turno. */
const TONE_CLASSES: Record<ReservationTone, string> = {
  paid: "bg-ink text-primary-foreground border border-transparent",
  deposit: "bg-ball text-ball-foreground border border-transparent",
  pending: "bg-card text-foreground border-[1.5px] border-dashed border-ink",
  cancelled:
    "bg-hatch text-muted-foreground line-through border border-transparent",
  fixed: "bg-line text-line-foreground border border-transparent",
};

export function toneClasses(tone: ReservationTone): string {
  return TONE_CLASSES[tone];
}

/** Nombre corto para mostrar un turno según su tipo. */
export function reservationTitle(
  reservation: Pick<Reservation, "kind" | "customer_name" | "participants">
): string {
  const people = sortedParticipants(reservation).map((p) => p.name);
  if (reservation.kind === "torneo" && people.length >= 2) {
    if (people.length >= 4) return `${people[0]} / ${people[1]} vs ${people[2]} / ${people[3]}`;
    if (people.length === 3) return `${people[0]} / ${people[1]} vs ${people[2]}`;
    return `${people[0]} vs ${people[1]}`;
  }
  if (reservation.kind === "profe") return `Prof. ${people[0] ?? reservation.customer_name}`;
  const extra = people.length > 1 ? ` +${people.length - 1}` : "";
  return `${people[0] ?? reservation.customer_name}${extra}`;
}

/** Los dos lados de un partido de torneo (singles: uno por lado; dobles: dos y dos). */
export function matchSides(reservation: Pick<Reservation, "participants" | "customer_name">): [string, string] {
  const people = sortedParticipants(reservation).map((p) => p.name);
  if (people.length >= 4) return [`${people[0]} / ${people[1]}`, `${people[2]} / ${people[3]}`];
  if (people.length === 3) return [`${people[0]} / ${people[1]}`, people[2]];
  return [people[0] ?? reservation.customer_name, people[1] ?? "Rival"];
}

/** Texto corto del resultado: "Ganó Pérez · 6-4 3-6 10-8" (vacío si no hay). */
export function resultLabel(
  reservation: Pick<Reservation, "kind" | "participants" | "customer_name" | "result_winner" | "result_score">
): string {
  if (reservation.kind !== "torneo" || (!reservation.result_winner && !reservation.result_score)) return "";
  const parts: string[] = [];
  if (reservation.result_winner) parts.push(`Ganó ${matchSides(reservation)[reservation.result_winner - 1]}`);
  if (reservation.result_score) parts.push(reservation.result_score);
  return parts.join(" · ");
}

/** Alumnos de un turno de profe (personas después del profe). */
export function profeStudents(reservation: Pick<Reservation, "participants">): string[] {
  return sortedParticipants(reservation).slice(1).map((p) => p.name);
}

export type ReservationLook = {
  className: string;
  style?: CSSProperties;
  /** Estado de pago como texto: en los tipos con color propio el relleno ya no lo indica. */
  paymentLabel: string | null;
};

/**
 * Aspecto de un turno en grilla, celular, Hoy y detalle (ver design.md, decisión 8).
 * Estándar: relleno por estado de pago. Profe: color del profe. Torneo: azul de marca.
 * Cancelado: siempre el tono de cancelado.
 */
export function reservationLook(
  reservation: Pick<Reservation, "kind" | "status" | "payment_status">,
  profeColor?: string | null
): ReservationLook {
  // Pedido en un horario con confirmación: ocupa el lugar, rayado hasta que el admin lo confirme.
  if (reservation.status === "pending_approval") {
    return {
      className: "bg-hatch text-foreground border-[1.5px] border-dashed border-line",
      paymentLabel: "Por confirmar",
    };
  }
  const tone = toneFor(reservation);
  if (reservation.status === "cancelled" || reservation.kind === "standard") {
    return { className: toneClasses(tone), paymentLabel: null };
  }
  const paymentLabel = RESERVATION_TONE_LABELS[tone];
  if (reservation.kind === "profe") {
    return {
      className: "text-white border border-transparent",
      style: { backgroundColor: profeColor ?? FALLBACK_PROFE_COLOR },
      paymentLabel,
    };
  }
  return { className: toneClasses("fixed"), paymentLabel };
}
