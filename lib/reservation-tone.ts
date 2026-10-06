import type { Reservation } from "@/lib/reservations";

/**
 * Tono visual de un turno. Única fuente de verdad para planilla, Hoy, celular y
 * detalle (ver specs/visual-identity). Los tonos se distinguen por luminosidad,
 * no solo por color. `fixed` queda reservado para turnos fijos (cambio futuro).
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
  fixed: "Fijo / clase",
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
