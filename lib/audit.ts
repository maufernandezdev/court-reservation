import { formatCancelWindow } from "@/lib/reservations";
import { CASH_CATEGORY_LABELS, type CashCategory } from "@/lib/cash";
import { describeRuleWhen } from "@/lib/approval";
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
  | "series.pricing_updated"
  | "reservation.account_closed"
  | "reservation.account_reopened"
  | "invitation.created"
  | "invitation.regenerated"
  | "invitation.revoked"
  | "invitation.accepted"
  | "cash.movement_created"
  | "cash.movement_voided"
  | "cash.opening_set"
  | "reservation.result_set"
  | "reservation.approved"
  | "reservation.rejected"
  | "approval_rule.created"
  | "approval_rule.removed"
  | "product.created"
  | "product.updated"
  | "payee.created"
  | "payee.updated"
  | "profe.settled"
  | "profe.settlement_voided"
  | "settings.settle_from_updated"
  | "special_day.applied"
  | "special_day.removed"
  | "series.updated_from";

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
    "cash.movement_created",
    "approval_rule.created",
    "product.created",
    "payee.created",
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
    "cash.opening_set",
    "reservation.result_set",
    "reservation.approved",
    "product.updated",
    "payee.updated",
    "series.pricing_updated",
    "reservation.account_closed",
    "reservation.account_reopened",
    "settings.settle_from_updated",
    "special_day.applied",
    "special_day.removed",
    "series.updated_from",
  ],
  charged: ["payment.registered", "credit.applied", "profe.settled"],
  cancelled: ["reservation.cancelled", "court.deactivated", "member.removed", "invitation.revoked", "player.removed", "series.ended", "cash.movement_voided", "reservation.rejected", "approval_rule.removed", "profe.settlement_voided"],
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
  organizador: "organizador de torneos",
};

const METHOD_TEXT: Record<string, string> = {
  efectivo: "en efectivo",
  mercado_pago: "por Mercado Pago",
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
    case "approval_rule.created":
    case "approval_rule.removed": {
      const when = describeRuleWhen({
        weekdays: (p.weekdays as number[] | null) ?? null,
        on_date: (p.on_date as string | null) ?? null,
        from_time: String(p.from_time ?? ""),
        to_time: String(p.to_time ?? ""),
      });
      const verb = entry.action === "approval_rule.created" ? "pidió confirmación del admin para" : "quitó la confirmación del admin de";
      return `${verb} ${when}${ctx.courtName ? ` en ${ctx.courtName}` : p.court_id ? "" : " (todas las canchas)"}`;
    }
    case "reservation.approved":
      return `confirmó el horario del turno${turno}`;
    case "reservation.rejected":
      return `rechazó el horario del turno${turno}${p.reason ? ` (${String(p.reason)})` : ""}`;
    case "reservation.result_set":
      return p.winner || p.score
        ? `cargó el resultado del partido${turno}${p.score ? `: ${String(p.score)}` : ""}${p.winner ? ` (ganó el lado ${String(p.winner)})` : ""}`
        : `borró el resultado del partido${turno}`;
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
      if (p.kind === "persona") {
        const payer = typeof p.payer_name === "string" && p.payer_name ? ` a ${p.payer_name}` : "";
        return `cobró ${money(p.amount)}${method ? ` ${method}` : ""}${payer}${who ? ` (${who})` : ""}${where ? ` · ${where}` : ""}`;
      }
      return `cobró ${money(p.amount)}${method ? ` ${method}` : ""}${who ? ` a ${who}` : ""}${where ? ` · ${where}` : ""}`;
    }
    case "reservation.account_closed": {
      const n = typeof p.people === "number" ? p.people : null;
      return `cerró la cuenta${who ? ` de ${who}` : ""}${n ? ` (${n} ${n === 1 ? "persona" : "personas"})` : ""}${where ? ` · ${where}` : ""}`;
    }
    case "reservation.account_reopened":
      return `reabrió la cuenta${who ? ` de ${who}` : ""}${where ? ` · ${where}` : ""}`;
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
      const torneo =
        p.torneo_price_per_hour === undefined
          ? ""
          : `; torneo ${money(p.torneo_price_per_hour)} y ${money(p.torneo_night_price_per_hour)}`;
      const prices = `${money(p.public_price_per_hour)} por hora de día y ${money(p.public_night_price_per_hour)} de noche (profe ${money(p.profe_price_per_hour)} y ${money(p.profe_night_price_per_hour)}${torneo})`;
      // Los registros anteriores a la seña por audiencia no la traen.
      if (p.public_deposit_enabled === undefined) return `cambió los precios de ${sport}: ${prices}`;
      return `cambió los precios de ${sport}: ${prices}; seña del público ${depositText(p, "public")}, seña de profes ${depositText(p, "profe")}`;
    }
    case "series.created": {
      const skipped = Array.isArray(p.skipped) ? p.skipped.length : 0;
      return `creó un turno fijo${who ? ` para ${who}` : ""}${where ? ` desde el ${where}` : ""}${skipped ? ` (${skipped} ${skipped === 1 ? "fecha salteada" : "fechas salteadas"})` : ""}`;
    }
    case "series.pricing_updated": {
      const mode = String(p.pricing_mode ?? "");
      const detail =
        mode === "sin_cargo"
          ? "sin cargo"
          : mode === "por_persona"
            ? `${money(p.unit_price)} por persona`
            : mode === "monto_fijo"
              ? `monto fijo de ${money(p.custom_price)}`
              : "precio de lista";
      const n = typeof p.updated === "number" ? p.updated : 0;
      return `cambió el precio del turno fijo a ${detail}${n ? ` (${n} ${n === 1 ? "fecha" : "fechas"})` : ""}`;
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
      if (p.social) {
        const parts = [
          p.whatsapp ? `WhatsApp ${String(p.whatsapp)}` : "sin WhatsApp",
          p.instagram ? `Instagram @${String(p.instagram)}` : "sin Instagram",
        ];
        return `cambió las redes del club: ${parts.join(", ")}`;
      }
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
    case "cash.movement_created":
    case "cash.movement_voided": {
      const method = METHOD_TEXT[String(p.method)] ?? "";
      const category = CASH_CATEGORY_LABELS[p.category as CashCategory]?.toLowerCase() ?? "movimiento";
      const detail =
        p.type === "in"
          ? `${p.concept ? String(p.concept) : category}${Number(p.quantity) > 1 ? ` ×${String(p.quantity)}` : ""}`
          : `${category}${p.counterparty ? ` a ${String(p.counterparty)}` : ""}`;
      const verb =
        entry.action === "cash.movement_voided"
          ? "anuló en la caja"
          : p.type === "in"
            ? "registró la venta de"
            : "registró la salida:";
      return `${verb} ${detail} por ${money(p.amount)}${method ? ` ${method}` : ""}`;
    }
    case "profe.settled": {
      const method = METHOD_TEXT[String(p.method)] ?? "";
      const range =
        typeof p.from === "string" && typeof p.to === "string"
          ? ` del ${shortDate(p.from)} al ${shortDate(p.to)}`
          : typeof p.to === "string"
            ? ` hasta el ${shortDate(p.to)}`
            : "";
      return `cobró la liquidación de ${String(p.profe || "un profe")}${range}: ${String(p.count ?? 0)} turnos por ${money(p.amount)}${method ? ` ${method}` : ""}`;
    }
    case "profe.settlement_voided":
      return `deshizo la liquidación de ${String(p.profe || "un profe")}: ${String(p.count ?? 0)} turnos volvieron a pendiente y se anularon ${money(p.amount)}`;
    case "settings.settle_from_updated":
      return typeof p.settle_from === "string"
        ? `fijó "Liquidar desde" en el ${shortDate(p.settle_from)}`
        : `quitó la fecha de "Liquidar desde"`;
    case "product.created":
      return `agregó el producto ${String(p.name ?? "")} a ${money(p.price)}`;
    case "product.updated":
      return p.active === false
        ? `dejó de vender ${String(p.name ?? "un producto")}`
        : `actualizó el producto ${String(p.name ?? "")} a ${money(p.price)}`;
    case "payee.created":
      return `agregó a ${String(p.name ?? "")} a la lista de pagos`;
    case "payee.updated":
      return p.active === false
        ? `sacó a ${String(p.name ?? "")} de la lista de pagos`
        : `actualizó a ${String(p.name ?? "")} en la lista de pagos`;
    case "special_day.applied": {
      const n = typeof p.cancelled === "number" ? p.cancelled : 0;
      const extras = [
        p.closed ? "club cerrado" : "",
        p.hourly_price ? `tarifa ${money(p.hourly_price)} por hora` : "",
        n ? `${n} ${n === 1 ? "turno cancelado" : "turnos cancelados"}` : "",
      ].filter(Boolean);
      return `marcó ${String(p.label ?? "feriado").toLowerCase()} el ${typeof p.date === "string" ? shortDate(p.date) : "día"}${extras.length ? ` (${extras.join(", ")})` : ""}`;
    }
    case "special_day.removed":
      return `quitó el día especial del ${typeof p.date === "string" ? shortDate(p.date) : "día"}`;
    case "series.updated_from": {
      const n = typeof p.updated === "number" ? p.updated : 0;
      return `cambió el turno fijo desde el ${typeof p.from === "string" ? shortDate(p.from) : "día"} (${n} ${n === 1 ? "fecha siguiente" : "fechas siguientes"})`;
    }
    case "cash.opening_set":
      return `fijó el cambio inicial de la caja${typeof p.date === "string" ? ` del ${shortDate(p.date)}` : ""} en ${money(p.amount)}`;
    case "settings.updated":
      return `cambió las políticas: ${typeof p.cancel_window_hours === "number" ? formatCancelWindow(p.cancel_window_hours) : "?"} de anticipación, penalidad del ${String(p.late_penalty_percent ?? "?")}%${p.tournament_duration_minutes ? `, torneos de ${String(p.tournament_duration_minutes)} min` : ""}`;
    default:
      return `hizo "${entry.action}"`;
  }
}
