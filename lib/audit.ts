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
  | "settings.updated";

type AuditInput = {
  ownerId: string;
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
    owner_id: input.ownerId,
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
  created: ["reservation.created", "court.created", "member.invited"],
  updated: ["reservation.updated", "court.updated", "member.role_updated", "settings.updated"],
  charged: ["payment.registered", "credit.applied"],
  cancelled: ["reservation.cancelled", "court.deactivated", "member.removed"],
};

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
    case "member.removed":
      return `quitó a ${ctx.memberName ?? "un miembro"} del club`;
    case "settings.updated":
      return `cambió las políticas: ${String(p.cancel_window_hours ?? "?")} h de anticipación, penalidad del ${String(p.late_penalty_percent ?? "?")}%`;
    default:
      return `hizo "${entry.action}"`;
  }
}
