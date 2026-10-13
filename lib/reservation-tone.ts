import type { CSSProperties } from "react";
import { sortedParticipants, type Reservation } from "@/lib/reservations";
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
