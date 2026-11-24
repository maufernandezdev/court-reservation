import { z } from "zod";
import { PRICING_MODES, type PricingMode } from "@/lib/special-pricing";

export const RESERVATION_STATUSES = ["active", "cancelled", "pending_approval", "rejected"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Estados que ocupan el lugar en la planilla: activo o esperando la confirmación del admin. */
export const OCCUPYING_STATUSES = ["active", "pending_approval"] as const satisfies readonly ReservationStatus[];

export function occupiesSlot(reservation: Pick<Reservation, "status">): boolean {
  return reservation.status === "active" || reservation.status === "pending_approval";
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  active: "Confirmado",
  cancelled: "Cancelado",
  pending_approval: "Por confirmar",
  rejected: "Rechazado",
};

/** Tipo de turno: estándar (público), de profe o de torneo. */
export const RESERVATION_KINDS = ["standard", "profe", "torneo"] as const;
export type ReservationKind = (typeof RESERVATION_KINDS)[number];

export const RESERVATION_KIND_LABELS: Record<ReservationKind, string> = {
  standard: "Estándar",
  profe: "Profe",
  torneo: "Torneo",
};

/**
 * Si quien mira puede editar o cancelar el turno: el personal (admin/operador) puede con todos;
 * un profesor solo con los que creó él o los que están a su nombre (aunque los haya cargado otro);
 * el organizador de torneos, con los turnos de torneo. Los demás los ve, pero no los toca.
 */
export function canManageReservation(
  membership: { role: string; user_id: string },
  reservation: { created_by: string | null; profe_user_id: string | null; kind?: ReservationKind }
): boolean {
  if (membership.role === "organizador") return reservation.kind === "torneo";
  return (
    membership.role !== "profesor" ||
    reservation.created_by === membership.user_id ||
    reservation.profe_user_id === membership.user_id
  );
}

/** Carga el resultado de un partido de torneo: admin, operador u organizador. */
export function canSetResult(role: string): boolean {
  return role === "admin" || role === "operador" || role === "organizador";
}

/** Resultado de un partido de torneo: ganador (lado 1 o 2) y marcador en texto libre. */
export const matchResultSchema = z.object({
  result_winner: z.union([z.literal(1), z.literal(2)]).nullable(),
  result_score: z
    .string()
    .trim()
    .max(60, "El marcador puede tener hasta 60 caracteres")
    .regex(/^[0-9 ()\-/,.]*$/, "Usá números, guiones y espacios (ej.: 6-4 3-6 10-8)"),
});
export type MatchResultInput = z.infer<typeof matchResultSchema>;

export const PAYMENT_STATUSES = ["pendiente", "senada", "pagada"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendiente: "Pendiente",
  senada: "Señada",
  pagada: "Pagada",
};

/** Cobros que se registran con "Cobrar" en el detalle del turno. */
export const PAYMENT_KINDS = ["seña", "total", "saldo"] as const;
/** "persona": cobro de una persona en un turno por persona (`register_person_payments`). */
export type PaymentKind = (typeof PAYMENT_KINDS)[number] | "persona";

/**
 * Modo de precio de un turno o fijo: de lista (lo que dice la lista de precios), sin cargo,
 * por persona (cuenta abierta que se cobra de a uno o en un cobro único) o monto fijo a mano.
 * Solo el admin pone uno distinto de "lista".
 */
export { PRICING_MODES, PRICING_MODE_LABELS, type PricingMode } from "@/lib/special-pricing";

/** Medios que acepta la base (transferencia y otro quedan para cobros viejos). */
export const PAYMENT_METHODS = ["efectivo", "mercado_pago", "transferencia", "otro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Medios que se ofrecen al cobrar o registrar un movimiento. */
export const VISIBLE_PAYMENT_METHODS = ["efectivo", "mercado_pago"] as const satisfies readonly PaymentMethod[];
export type VisiblePaymentMethod = (typeof VISIBLE_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  mercado_pago: "Mercado Pago",
  transferencia: "Transferencia",
  otro: "Otro",
};

/** Rótulo corto (planilla, listas): "Efectivo", "MP"… */
export const PAYMENT_METHOD_SHORT: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  mercado_pago: "MP",
  transferencia: "Transf.",
  otro: "Otro",
};

export type Payment = {
  id: string;
  club_id: string;
  reservation_id: string;
  kind: PaymentKind;
  amount: number;
  method: PaymentMethod;
  external_ref: string | null;
  released: boolean;
  /** Quién pagó, en los cobros por persona (opcional). */
  payer_name?: string | null;
  created_by: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  club_id: string;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Reservation = {
  id: string;
  club_id: string;
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
  kind: ReservationKind;
  /** Profe que usa el turno (solo en turnos de profe). */
  profe_user_id: string | null;
  /**
   * Valor fijado al reservar (precio del tipo de cancha × duración). Llega en null a quien no
   * puede ver montos (organizador de torneos): la vista `reservation_board` no lo muestra.
   */
  price: number;
  /** Serie del turno fijo semanal, si es una fecha de un fijo. */
  series_id: string | null;
  /**
   * Precio especial. En "por_persona", `price` es lo cobrado hasta ahora y `unit_price` el precio
   * por persona (null para quien no ve montos); `expected_people` es la cantidad habitual y, al
   * cerrar, la que vino. `closed_at` marca la cuenta cerrada.
   */
  pricing_mode: PricingMode;
  unit_price: number | null;
  expected_people: number | null;
  closed_at: string | null;
  closed_by: string | null;
  /** Torneo: lado ganador (1 = primeros jugadores, 2 = los otros) y marcador ("6-4 3-6 10-8"). */
  result_winner?: 1 | 2 | null;
  result_score?: string | null;
  /** Horario con confirmación: quién y cuándo lo confirmó o lo rechazó el admin. */
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  /** Personas del turno (si la consulta las trae embebidas), ordenadas por posición. */
  participants?: ReservationParticipant[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

/** Persona de un turno: player del club (`player_id`) o persona sin registrar (solo nombre). */
/** Persona guardada en un turno (`reservation_participants`). */
export type ReservationParticipant = {
  position: number;
  name: string;
  player_id: string | null;
};

/**
 * De dónde lee la app los turnos: la vista `reservation_board` (todas las columnas, con el precio
 * en null para quien no puede ver montos). La tabla `reservations` queda para escribir.
 */
export const RESERVATION_SOURCE = "reservation_board";

/** Select de turnos con sus personas embebidas. */
export const RESERVATION_SELECT = "*, participants:reservation_participants(position, name, player_id)";

/** Personas ordenadas por posición (PostgREST no garantiza el orden del embebido). */
export function sortedParticipants(reservation: Pick<Reservation, "participants">): ReservationParticipant[] {
  return [...(reservation.participants ?? [])].sort((a, b) => a.position - b.position);
}

export type ReservationPerson = {
  name: string;
  player_id: string | null;
  /** Teléfono de la ficha del jugador (para completar el del turno). */
  phone?: string;
};

export const MAX_PEOPLE = 4;

export const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const personSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre de una persona").max(120, "Nombre demasiado largo"),
  player_id: z.string().uuid().nullable(),
  phone: z.string().optional(),
});

/**
 * Alta y edición de un turno. `people` son las personas que carga el usuario:
 * en turnos estándar y de torneo la primera es quien reserva; en turnos de profe
 * son los alumnos (opcionales) y quien reserva es el profe.
 */
export const reservationInputSchema = z
  .object({
    court_id: z.string().uuid("Seleccioná una cancha válida"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida"),
    time: z.string().regex(timeRegex, "Ingresá un horario válido (HH:MM)"),
    phone: z
      .string()
      .trim()
      .max(15, "El teléfono puede tener hasta 15 números")
      .regex(/^\d*$/, "El teléfono solo puede tener números"),
    kind: z.enum(RESERVATION_KINDS, { message: "Elegí el tipo de turno" }),
    profe_user_id: z.string().uuid().nullable(),
    /** De 30 min a 6 h (8 h en torneos), en pasos de 30: la elige quien reserva en cualquier tipo de turno. */
    duration_minutes: z.coerce.number().int(),
    people: z.array(personSchema).max(MAX_PEOPLE, `Hasta ${MAX_PEOPLE} personas por turno`),
    /** Solo en el alta: el turno se repite todas las semanas (no aplica a torneos). */
    repeat_weekly: z.boolean(),
    /** Precio especial (solo lo usa el admin; para los demás el servidor lo ignora). */
    pricing_mode: z.enum(PRICING_MODES, { message: "Elegí cómo se cobra" }),
    unit_price: z.number({ message: "Poné el precio por persona" }).positive("El precio tiene que ser mayor a $0").max(10_000_000, "Precio demasiado alto").nullable(),
    expected_people: z.number().int("Poné un número entero").min(1, "Al menos 1 persona").max(200, "Hasta 200 personas").nullable(),
    custom_price: z.number({ message: "Poné el monto del turno" }).min(0, "El monto no puede ser negativo").max(10_000_000, "Monto demasiado alto").nullable(),
  })
  .superRefine((data, ctx) => {
    const maxHours = data.kind === "torneo" ? 8 : 6;
    if (data.duration_minutes < 30 || data.duration_minutes > maxHours * 60 || data.duration_minutes % 30 !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["duration_minutes"],
        message: `La duración va de 30 min a ${maxHours} h, en pasos de 30`,
      });
    }
    if (data.pricing_mode === "por_persona" && data.unit_price === null) {
      ctx.addIssue({ code: "custom", path: ["unit_price"], message: "Poné el precio por persona" });
    }
    if (data.pricing_mode === "monto_fijo" && data.custom_price === null) {
      ctx.addIssue({ code: "custom", path: ["custom_price"], message: "Poné el monto del turno" });
    }
    if (data.repeat_weekly && data.kind === "torneo") {
      ctx.addIssue({ code: "custom", path: ["repeat_weekly"], message: "Los turnos de torneo no pueden ser fijos" });
    }
    if (data.kind === "profe") {
      if (!data.profe_user_id) {
        ctx.addIssue({ code: "custom", path: ["profe_user_id"], message: "Elegí qué profe usa la cancha" });
      }
      if (data.people.length > MAX_PEOPLE - 1) {
        ctx.addIssue({ code: "custom", path: ["people"], message: `Hasta ${MAX_PEOPLE - 1} alumnos` });
      }
      return;
    }
    if (data.people.length === 0) {
      ctx.addIssue({ code: "custom", path: ["people"], message: "Indicá quién reserva el turno" });
    }
    if (data.kind === "torneo") {
      if (data.people.length < 2) {
        ctx.addIssue({ code: "custom", path: ["people"], message: "Un torneo necesita al menos 2 jugadores" });
      }
    }
  });

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(200, "El motivo es demasiado largo").default(""),
});

export const registerPaymentSchema = z.object({
  kind: z.enum(PAYMENT_KINDS, { message: "Tipo de cobro inválido" }),
  method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
});

export type ClubSettings = {
  club_id: string;
  cancel_window_hours: number;
  late_penalty_percent: number;
  /** Duración con la que arranca un turno de torneo (editable en cada turno). */
  tournament_duration_minutes: number;
  /** Hora desde la que rige el precio de noche ("HH:MM:SS" como lo devuelve PostgREST). */
  night_starts_at: string;
  /** Horario de apertura y cierre del club ("HH:MM:SS" como lo devuelve PostgREST). */
  open_time: string;
  close_time: string;
  /** Redes del club (Políticas): WhatsApp solo con números e Instagram sin @. Vacío si no se cargaron. */
  whatsapp: string;
  instagram: string;
  updated_at: string;
};

/** Ventana de cancelación legible: 0.5 → "30 min", 1 → "1 h", 1.5 → "1 h 30 min". */
export function formatCancelWindow(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const clubSettingsSchema = z.object({
  cancel_window_hours: z.coerce
    .number({ message: "Ingresá un número válido" })
    .min(0, "Las horas de anticipación no pueden ser negativas")
    .max(24 * 30, "La ventana no puede superar 720 horas")
    .refine((value) => Number.isInteger(value * 2), "Va en pasos de media hora (0,5 / 1 / 1,5…)"),
  late_penalty_percent: z.coerce
    .number({ message: "Ingresá un porcentaje válido" })
    .min(0, "El porcentaje no puede ser negativo")
    .max(100, "El porcentaje no puede superar 100"),
  tournament_duration_minutes: z.coerce
    .number({ message: "Elegí la duración de los torneos" })
    .int()
    .min(30, "La duración mínima es de 30 minutos")
    .max(360, "La duración máxima es de 6 horas")
    .refine((value) => value % 30 === 0, "La duración va en pasos de 30 minutos"),
});
