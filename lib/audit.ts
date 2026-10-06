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
