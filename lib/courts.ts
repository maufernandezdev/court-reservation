import { z } from "zod";

export const COURT_TYPES = ["futbol", "tenis", "padel"] as const;
export type CourtType = (typeof COURT_TYPES)[number];

export const courtSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre para la cancha"),
  type: z.enum(COURT_TYPES, {
    message: "Seleccioná un tipo de cancha",
  }),
});

export type CourtInput = z.infer<typeof courtSchema>;

export const COURT_TYPE_LABELS: Record<CourtType, string> = {
  futbol: "Fútbol",
  tenis: "Tenis",
  padel: "Pádel",
};

export type Court = {
  id: string;
  user_id: string;
  name: string;
  type: CourtType;
  active: boolean;
  created_at: string;
};
