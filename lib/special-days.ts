import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { formatMoney } from "@/lib/pricing";

/** Día especial del club (feriado): si cierra y la tarifa por hora de ese día. */
export type SpecialDay = {
  date: string;
  label: string;
  closed: boolean;
  hourly_price: number | null;
};

export const SPECIAL_DAY_CANCEL_OPTIONS = ["none", "fijos", "todos"] as const;
export type SpecialDayCancel = (typeof SPECIAL_DAY_CANCEL_OPTIONS)[number];

export const specialDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha válida"),
  label: z.string().trim().min(1, "Poné un nombre, por ejemplo “Feriado”").max(60, "Hasta 60 caracteres"),
  closed: z.boolean(),
  hourlyPrice: z.union([
    z.literal(""),
    z.string().regex(/^\d{1,7}$/, "Ingresá un monto sin puntos ni comas"),
  ]),
  cancel: z.enum(SPECIAL_DAY_CANCEL_OPTIONS),
});
export type SpecialDayInput = z.infer<typeof specialDaySchema>;

/** Persona con un turno cancelado por el feriado (para avisarle). */
export type SpecialDayAffected = {
  name: string;
  phone: string;
  time: string;
  court: string;
  fixed: boolean;
  released: number;
};

export async function querySpecialDay(
  supabase: SupabaseClient,
  clubId: string,
  date: string
): Promise<SpecialDay | null> {
  const { data } = await supabase
    .from("club_special_days")
    .select("date, label, closed, hourly_price")
    .eq("club_id", clubId)
    .eq("date", date)
    .maybeSingle();
  if (!data) return null;
  return { ...data, hourly_price: data.hourly_price === null ? null : Number(data.hourly_price) } as SpecialDay;
}

export function specialDaySummary(day: SpecialDay): string {
  const parts = [day.label];
  if (day.closed) parts.push("club cerrado");
  if (day.hourly_price !== null) parts.push(`tarifa ${formatMoney(day.hourly_price)} por hora`);
  return parts.join(" · ");
}
