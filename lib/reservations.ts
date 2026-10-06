import { z } from "zod";

export const RESERVATION_STATUSES = ["active", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PAYMENT_STATUSES = ["pendiente", "senada", "pagada"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendiente: "Pendiente",
  senada: "Señada",
  pagada: "Pagada",
};

export const PAYMENT_KINDS = ["seña", "total", "saldo"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["efectivo", "transferencia", "otro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
};

export type Payment = {
  id: string;
  owner_id: string;
  reservation_id: string;
  kind: PaymentKind;
  amount: number;
  method: PaymentMethod;
  external_ref: string | null;
  released: boolean;
  created_by: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  owner_id: string;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Reservation = {
  id: string;
  user_id: string;
  court_id: string;
  date: string; // YYYY-MM-DD
  time: string; // "HH:MM", inicio del turno
  duration_minutes: number;
  customer_name: string;
  phone: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  late_cancel: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const reservationInputSchema = z.object({
  court_id: z.string().uuid("Seleccioná una cancha válida"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida"),
  time: z.string().regex(timeRegex, "Ingresá un horario válido (HH:MM)"),
  customer_name: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del socio o equipo"),
  phone: z.string().trim(),
});

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(200, "El motivo es demasiado largo").default(""),
});

export const registerPaymentSchema = z.object({
  kind: z.enum(PAYMENT_KINDS, { message: "Tipo de cobro inválido" }),
  method: z.enum(PAYMENT_METHODS, { message: "Método de pago inválido" }),
});

export type ClubSettings = {
  owner_id: string;
  cancel_window_hours: number;
  late_penalty_percent: number;
  updated_at: string;
};

export const clubSettingsSchema = z.object({
  cancel_window_hours: z.coerce
    .number({ message: "Ingresá un número válido" })
    .int("Ingresá un número entero")
    .min(0, "Las horas de anticipación no pueden ser negativas")
    .max(24 * 30, "La ventana no puede superar 720 horas"),
  late_penalty_percent: z.coerce
    .number({ message: "Ingresá un porcentaje válido" })
    .min(0, "El porcentaje no puede ser negativo")
    .max(100, "El porcentaje no puede superar 100"),
});
