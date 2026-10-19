import { z } from "zod";

export const COURT_TYPES = ["futbol", "tenis", "padel"] as const;
export type CourtType = (typeof COURT_TYPES)[number];

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

/** Cancha: nombre y tipo. El precio y la seña son por tipo de cancha (`sport_prices`); el horario es del club y la duración, de cada turno. */
export const courtSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre para la cancha"),
  type: z.enum(COURT_TYPES, {
    message: "Seleccioná un tipo de cancha",
  }),
});

export type CourtInput = z.infer<typeof courtSchema>;

export type Court = {
  id: string;
  club_id: string;
  name: string;
  type: CourtType;
  active: boolean;
  created_at: string;
};
