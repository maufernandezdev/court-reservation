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

/** Cancha: nombre, tipo, duración del turno y horario. El precio y la seña son por tipo de cancha (`sport_prices`). */
export const courtSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá un nombre para la cancha"),
    type: z.enum(COURT_TYPES, {
      message: "Seleccioná un tipo de cancha",
    }),
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
  })
  .refine((data) => data.open_time < data.close_time, {
    message: "El horario de cierre debe ser posterior al de apertura",
    path: ["close_time"],
  });

export type CourtInput = z.infer<typeof courtSchema>;

export type Court = {
  id: string;
  club_id: string;
  name: string;
  type: CourtType;
  active: boolean;
  slot_duration: SlotDuration;
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
  created_at: string;
};
