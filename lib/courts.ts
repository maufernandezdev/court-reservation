import { z } from "zod";

export const COURT_TYPES = ["futbol", "tenis", "padel"] as const;
export type CourtType = (typeof COURT_TYPES)[number];

export const SLOT_DURATIONS = [30, 60, 90] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];

export const DEPOSIT_TYPES = ["fixed", "percent"] as const;
export type DepositType = (typeof DEPOSIT_TYPES)[number];

export const COURT_TYPE_LABELS: Record<CourtType, string> = {
  futbol: "Fútbol",
  tenis: "Tenis",
  padel: "Pádel",
};

export const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  fixed: "Monto fijo",
  percent: "Porcentaje",
};

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const courtSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá un nombre para la cancha"),
    type: z.enum(COURT_TYPES, {
      message: "Seleccioná un tipo de cancha",
    }),
    price_per_hour: z.coerce
      .number({ message: "Ingresá un precio válido" })
      .positive("El precio por hora debe ser mayor a cero"),
    slot_duration: z.coerce
      .number({ message: "Seleccioná la duración del turno" })
      .refine(
        (value) => (SLOT_DURATIONS as readonly number[]).includes(value),
        "La duración debe ser 30, 60 o 90 minutos"
      ),
    open_time: z
      .string()
      .regex(timeRegex, "Ingresá un horario válido (HH:MM)"),
    close_time: z
      .string()
      .regex(timeRegex, "Ingresá un horario válido (HH:MM)"),
    deposit_enabled: z.boolean(),
    deposit_type: z.enum(DEPOSIT_TYPES, {
      message: "Seleccioná el tipo de seña",
    }),
    deposit_value: z.coerce
      .number({ message: "Ingresá un valor de seña válido" })
      .min(0, "El valor de la seña no puede ser negativo"),
  })
  .refine((data) => data.open_time < data.close_time, {
    message: "El horario de cierre debe ser posterior al de apertura",
    path: ["close_time"],
  })
  .refine(
    (data) =>
      !data.deposit_enabled ||
      data.deposit_type !== "fixed" ||
      data.deposit_value <= (data.price_per_hour * data.slot_duration) / 120,
    {
      message:
        "La seña fija no puede superar el valor del turno más corto (duración mínima del club)",
      path: ["deposit_value"],
    }
  );

export type CourtInput = z.infer<typeof courtSchema>;

export type Court = {
  id: string;
  club_id: string;
  name: string;
  type: CourtType;
  active: boolean;
  price_per_hour: number;
  slot_duration: SlotDuration;
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
  deposit_enabled: boolean;
  deposit_type: DepositType;
  deposit_value: number;
  created_at: string;
};
