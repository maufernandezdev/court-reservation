import { z } from "zod";
import { normalizeTime, timeToMinutes } from "@/lib/availability";

/**
 * Horarios con confirmación del admin (tabla `approval_rules`). Un turno que cargan operador,
 * profe u organizador dentro de una franja queda "Por confirmar" (lo aplica la base; acá se
 * replica para avisar en el formulario).
 */
export type ApprovalRule = {
  id: string;
  club_id: string;
  /** null = todas las canchas. */
  court_id: string | null;
  /** Días de la semana (0 = domingo); null si la regla es para una fecha puntual. */
  weekdays: number[] | null;
  on_date: string | null;
  from_time: string;
  to_time: string;
  created_at: string;
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_SHORT: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** ¿El turno cae en alguna franja con confirmación? (misma regla que `requires_approval`). */
export function requiresApproval(
  rules: Pick<ApprovalRule, "court_id" | "weekdays" | "on_date" | "from_time" | "to_time">[],
  courtId: string,
  date: string,
  time: string,
  durationMinutes: number
): boolean {
  if (!courtId || !date || !time) return false;
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  const weekday = weekdayOf(date);
  return rules.some(
    (rule) =>
      (rule.court_id === null || rule.court_id === courtId) &&
      (rule.on_date === date || (rule.weekdays ?? []).includes(weekday)) &&
      start < timeToMinutes(normalizeTime(rule.to_time)) &&
      end > timeToMinutes(normalizeTime(rule.from_time))
  );
}

/** "Lun a Vie · 19:00 a 23:00" o "Sáb 20/12 · 18:00 a 22:00". */
export function describeRuleWhen(rule: Pick<ApprovalRule, "weekdays" | "on_date" | "from_time" | "to_time">): string {
  const hours = `${normalizeTime(rule.from_time)} a ${normalizeTime(rule.to_time)}`;
  if (rule.on_date) {
    const [, m, d] = rule.on_date.split("-");
    return `${WEEKDAY_SHORT[weekdayOf(rule.on_date)]} ${d}/${m} · ${hours}`;
  }
  const days = [...(rule.weekdays ?? [])].sort((a, b) => WEEKDAYS.indexOf(a as 0) - WEEKDAYS.indexOf(b as 0));
  const ordered = WEEKDAYS.filter((d) => days.includes(d));
  const isRun =
    ordered.length > 2 && WEEKDAYS.indexOf(ordered[ordered.length - 1]) - WEEKDAYS.indexOf(ordered[0]) === ordered.length - 1;
  const label =
    ordered.length === 7
      ? "Todos los días"
      : isRun
        ? `${WEEKDAY_SHORT[ordered[0]]} a ${WEEKDAY_SHORT[ordered[ordered.length - 1]]}`
        : ordered.map((d) => WEEKDAY_SHORT[d]).join(", ");
  return `${label} · ${hours}`;
}

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elegí un horario válido");

/** Alta de una franja (Políticas, solo admin). */
export const approvalRuleSchema = z
  .object({
    court_id: z.string().uuid().nullable(),
    mode: z.enum(["weekdays", "date"]),
    weekdays: z.array(z.number().int().min(0).max(6)),
    on_date: z.string(),
    from_time: timeSchema,
    to_time: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Elegí un horario válido"),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "weekdays" && data.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Elegí al menos un día" });
    }
    if (data.mode === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(data.on_date)) {
      ctx.addIssue({ code: "custom", path: ["on_date"], message: "Elegí la fecha" });
    }
    if (timeToMinutes(data.from_time) >= timeToMinutes(data.to_time)) {
      ctx.addIssue({ code: "custom", path: ["to_time"], message: "Tiene que terminar después de empezar" });
    }
  });
export type ApprovalRuleInput = z.infer<typeof approvalRuleSchema>;

/** Link de WhatsApp: al número indicado o, sin número, para elegir el chat. */
export function whatsappLink(number: string | null | undefined, text: string): string {
  const digits = (number ?? "").replace(/\D/g, "");
  const to = digits.length >= 8 ? (digits.startsWith("54") ? digits : `549${digits}`) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** "Avisar al admin por WhatsApp": mensaje armado con el turno pedido. */
export function approvalWhatsappHref(
  clubWhatsapp: string | null | undefined,
  turn: { clubName: string; title: string; courtName: string; date: string; time: string }
): string {
  const [, m, d] = turn.date.split("-");
  const text = `Hola, pedí un turno en un horario que necesita confirmación en ${turn.clubName}: ${turn.title}, ${turn.courtName}, el ${d}/${m} a las ${turn.time}. ¿Lo podés confirmar desde Altenor (Hoy → Para confirmar)? Gracias.`;
  return whatsappLink(clubWhatsapp, text);
}
