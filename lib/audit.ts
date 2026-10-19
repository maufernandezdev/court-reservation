import { formatCancelWindow } from "@/lib/reservations";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "reservation.created"
  | "reservation.updated"
  | "reservation.cancelled"
  | "payment.registered"
  | "credit.applied"
  | "court.created"
  | "court.updated"
  | "court.deactivated"
  | "member.invited"
  | "member.removed"
  | "member.role_updated"
  | "member.color_updated"
  | "settings.updated"
  | "club.created"
  | "club.updated"
  | "prices.updated"
  | "player.created"
  | "player.updated"
  | "player.removed"
  | "series.created"
  | "series.ended"
  | "invitation.created"
  | "invitation.regenerated"
  | "invitation.revoked"
  | "invitation.accepted";

type AuditInput = {
  clubId: string;
  actorId: string | null;
  entity: string;
  entityId?: string | null;
  action: AuditAction;
  payload?: Record<string, unknown>;
};

/** Escribe una entrada en el log de auditoría (append-only). */
export async function writeAudit(
  supabase: SupabaseClient,
  input: AuditInput
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    club_id: input.clubId,
    actor_id: input.actorId,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    action: input.action,
    payload: input.payload ?? {},
  });

  if (error) {
    // No frenar la operación principal por un error de auditoría, pero dejar rastro.
    console.error("Error escribiendo audit_log:", error);
  }
}

/** Grupo de la acción para filtrar y etiquetar en Actividad. */
export const AUDIT_KINDS = ["created", "updated", "charged", "cancelled"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export const AUDIT_KIND_LABELS: Record<AuditKind, string> = {
  created: "Creó",
  updated: "Modificó",
  charged: "Cobró",
  cancelled: "Canceló",
};

export const AUDIT_ACTIONS_BY_KIND: Record<AuditKind, AuditAction[]> = {
  created: [
    "reservation.created",
    "court.created",
    "member.invited",
    "club.created",
    "invitation.created",
    "invitation.accepted",
    "player.created",
    "series.created",
  ],
  updated: [
    "reservation.updated",
    "court.updated",
    "member.role_updated",
    "member.color_updated",
    "settings.updated",
    "club.updated",
    "invitation.regenerated",
    "prices.updated",
    "player.updated",
  ],
  charged: ["payment.registered", "credit.applied"],
  cancelled: ["reservation.cancelled", "court.deactivated", "member.removed", "invitation.revoked", "player.removed", "series.ended"],
};

function depositText(p: Record<string, unknown>, audience: "public" | "profe"): string {
  if (!p[`${audience}_deposit_enabled`]) return "no pide";
  const value = p[`${audience}_deposit_value`];
  return p[`${audience}_deposit_type`] === "fixed" ? money(value) : `${String(value)} %`;
}

export function auditKindOf(action: string): AuditKind {
  for (const kind of AUDIT_KINDS) {
    if ((AUDIT_ACTIONS_BY_KIND[kind] as string[]).includes(action)) return kind;
  }
  return "updated";
}

/** Datos de contexto para describir una entrada (resueltos por quien la muestra). */
export type AuditContext = {
  reservation?: { customer_name: string; date: string; time: string; courtName?: string };
  courtName?: string;
  memberName?: string;
};

const ROLE_NAMES: Record<string, string> = {
  admin: "administrador",
  operador: "operador",
  profesor: "profesor",
};

const METHOD_TEXT: Record<string, string> = {
  efectivo: "en efectivo",
  transferencia: "por transferencia",
  otro: "",
};

function money(value: unknown): string {
  const n = Number(value);
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

/**
 * Frase en español (sin el nombre de quien la hizo) para una entrada del
 * `audit_log`. Si faltan datos de contexto, cae en un texto genérico.
 */
export function describeAuditEntry(
  entry: { action: string; payload: Record<string, unknown> | null },
  ctx: AuditContext = {}
): string {
  const p = entry.payload ?? {};
  const r = ctx.reservation;
  const who = r?.customer_name ?? (typeof p.customer_name === "string" ? p.customer_name : null);
  const where = r
    ? `${r.courtName ? `${r.courtName}, ` : ""}${shortDate(r.date)} ${r.time}`
    : typeof p.date === "string" && typeof p.time === "string"
      ? `${shortDate(p.date)} ${p.time}`
      : null;
  const turno = `${who ? ` de ${who}` : ""}${where ? ` · ${where}` : ""}`;

  switch (entry.action) {
    case "reservation.created":
      return `creó un turno${who ? ` para ${who}` : ""}${where ? ` · ${where}` : ""}`;
    case "reservation.updated":
      return `modificó el turno${turno}`;
    case "reservation.cancelled": {
      const details = [
        p.late ? "fuera de término" : "en término",
        p.retained ? `retiene ${money(p.retained)}` : null,
        p.released ? `${money(p.released)} a saldo a favor` : null,
        p.debt ? `deuda de ${money(p.debt)}` : null,
      ].filter(Boolean);
      return `canceló el turno${turno} (${details.join(", ")})`;
    }
    case "payment.registered": {
      const method = METHOD_TEXT[String(p.method)] ?? "";
      if (p.kind === "seña") {
        return `registró la seña de ${money(p.amount)}${method ? ` ${method}` : ""}${who ? ` de ${who}` : ""}${where ? ` · ${where}` : ""}`;
      }
      return `cobró ${money(p.amount)}${method ? ` ${method}` : ""}${who ? ` a ${who}` : ""}${where ? ` · ${where}` : ""}`;
    }
    case "credit.applied":
      return `aplicó ${money(p.amount)} de saldo a favor${turno}`;
    case "court.created":
      return `creó la cancha ${String(p.name ?? ctx.courtName ?? "")}`.trim();
    case "court.updated":
      return `modificó la cancha ${String(p.name ?? ctx.courtName ?? "")}`.trim();
    case "court.deactivated":
      return `dio de baja la cancha${ctx.courtName ? ` ${ctx.courtName}` : ""}`;
    case "member.invited":
      return `sumó a ${String(p.email ?? "una persona")} como ${ROLE_NAMES[String(p.role)] ?? String(p.role ?? "miembro")}`;
    case "member.role_updated":
      return `cambió el rol de ${ctx.memberName ?? "un miembro"} a ${ROLE_NAMES[String(p.role)] ?? String(p.role)}`;
    case "member.color_updated":
      return `cambió el color de ${ctx.memberName ?? "un profe"} en la planilla`;
    case "member.removed":
      return `quitó a ${ctx.memberName ?? "un miembro"} del club`;
    case "club.created": {
      const counts = (p.courts ?? {}) as Record<string, unknown>;
      const total = Object.values(counts).reduce<number>((sum, n) => sum + (Number(n) || 0), 0);
      return `creó el club ${String(p.name ?? "")}${total ? ` con ${total} ${total === 1 ? "cancha" : "canchas"}` : ""}`.trim();
    }
    case "prices.updated": {
      if (p.night_starts_at) {
        return `cambió el inicio del horario de noche a las ${String(p.night_starts_at)}`;
      }
      const sport = { tenis: "tenis", padel: "pádel", futbol: "fútbol" }[String(p.sport)] ?? String(p.sport ?? "");
      // Los registros anteriores al precio de noche no traen los valores de noche.
      if (p.public_night_price_per_hour === undefined) {
        return `cambió los precios de ${sport}: ${money(p.public_price_per_hour)} por hora (profe ${money(p.profe_price_per_hour)})`;
      }
      const prices = `${money(p.public_price_per_hour)} por hora de día y ${money(p.public_night_price_per_hour)} de noche (profe ${money(p.profe_price_per_hour)} y ${money(p.profe_night_price_per_hour)})`;
      // Los registros anteriores a la seña por audiencia no la traen.
      if (p.public_deposit_enabled === undefined) return `cambió los precios de ${sport}: ${prices}`;
      return `cambió los precios de ${sport}: ${prices}; seña del público ${depositText(p, "public")}, seña de profes ${depositText(p, "profe")}`;
    }
    case "series.created": {
      const skipped = Array.isArray(p.skipped) ? p.skipped.length : 0;
      return `creó un turno fijo${who ? ` para ${who}` : ""}${where ? ` desde el ${where}` : ""}${skipped ? ` (${skipped} ${skipped === 1 ? "fecha salteada" : "fechas salteadas"})` : ""}`;
    }
    case "series.ended":
      return `dio de baja el turno fijo${who ? ` de ${who}` : ""}${typeof p.from === "string" ? ` desde el ${shortDate(p.from)}` : ""}`;
    case "player.created":
      return `dio de alta al jugador ${String(p.full_name ?? "")}`.trim();
    case "player.updated":
      return `modificó los datos del jugador ${String(p.full_name ?? "")}`.trim();
    case "player.removed":
      return `dio de baja al jugador ${String(p.full_name ?? "")}`.trim();
    case "club.updated":
      if (p.logo) {
        return p.logo === "removed" ? "quitó el logo del club" : "cambió el logo del club";
      }
      if (p.open_time) {
        return `cambió el horario del club: de ${String(p.open_time)} a ${String(p.close_time)}`;
      }
      return `cambió los datos del club: ${String(p.name ?? "")}${p.city ? ` (${String(p.city)})` : ""}`;
    case "invitation.created": {
      const role = ROLE_NAMES[String(p.role)] ?? String(p.role ?? "miembro");
      // Las invitaciones anteriores a las de solo rol llevaban nombre y correo.
      if (p.full_name || p.email) return `invitó a ${String(p.full_name || p.email)} como ${role}`;
      return `generó una invitación de ${role}${p.note ? ` (${String(p.note)})` : ""}`;
    }
    case "invitation.regenerated": {
      const who = String(p.full_name || p.email || p.note || "");
      return `generó un link nuevo para la invitación${who ? ` de ${who}` : ""}`;
    }
    case "invitation.revoked": {
      const who = String(p.full_name || p.email || p.note || "");
      return `canceló la invitación${who ? ` de ${who}` : ""}`;
    }
    case "invitation.accepted":
      return `se sumó al club como ${ROLE_NAMES[String(p.role)] ?? String(p.role ?? "miembro")}`;
    case "settings.updated":
      return `cambió las políticas: ${typeof p.cancel_window_hours === "number" ? formatCancelWindow(p.cancel_window_hours) : "?"} de anticipación, penalidad del ${String(p.late_penalty_percent ?? "?")}%${p.tournament_duration_minutes ? `, torneos de ${String(p.tournament_duration_minutes)} min` : ""}`;
    default:
      return `hizo "${entry.action}"`;
  }
}
