"use server";

import { revalidatePath } from "next/cache";
import {
  memberInviteSchema,
  memberRoleSchema,
  type MemberInviteInput,
} from "@/lib/members";
import type { ClubRole } from "@/lib/roles";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { SharedInvitation } from "@/lib/invitations";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationLink,
} from "@/lib/invitations-server";

type InvitationResult = {
  success: boolean;
  error?: string;
  invitation?: SharedInvitation;
};

const INVITATION_DAYS = 7;

function expiresAtFromNow(): string {
  return new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Crea la invitación y devuelve el link (el token no se guarda: solo su hash). */
export async function createInvitationAction(
  input: MemberInviteInput
): Promise<InvitationResult> {
  const parsed = memberInviteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const email = parsed.data.email.trim().toLowerCase();
    const fullName = parsed.data.full_name.trim();

    const { data: existingMember } = await supabase
      .from("memberships")
      .select("id")
      .eq("club_id", clubId)
      .eq("email", email)
      .maybeSingle();

    if (existingMember) {
      return { success: false, error: "Esa persona ya es parte del equipo." };
    }

    const token = generateInvitationToken();
    const expiresAt = expiresAtFromNow();

    const { data, error } = await supabase
      .from("club_invitations")
      .insert({
        club_id: clubId,
        email,
        full_name: fullName,
        role: parsed.data.role,
        token_hash: hashInvitationToken(token),
        invited_by: user!.id,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error:
            "Ya hay una invitación abierta para ese correo. Generá un link nuevo desde la lista de invitaciones.",
        };
      }
      return { success: false, error: "No se pudo crear la invitación." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "invitation",
      entityId: data.id,
      action: "invitation.created",
      payload: { email, role: parsed.data.role, full_name: fullName },
    });

    revalidatePath("/dashboard/miembros");

    return {
      success: true,
      invitation: {
        link: await invitationLink(token),
        email,
        fullName,
        role: parsed.data.role,
        expiresAt,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo crear la invitación.",
    };
  }
}

/** Link nuevo para una invitación abierta: invalida el anterior y renueva el vencimiento. */
export async function regenerateInvitationAction(
  invitationId: string
): Promise<InvitationResult> {
  const parsedId = z.string().uuid("Invitación inválida.").safeParse(invitationId);
  if (!parsedId.success) {
    return { success: false, error: "Invitación inválida." };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const token = generateInvitationToken();
    const expiresAt = expiresAtFromNow();

    const { data, error } = await supabase
      .from("club_invitations")
      .update({ token_hash: hashInvitationToken(token), expires_at: expiresAt })
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id, email, full_name, role")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: "No se encontró la invitación (puede que ya la hayan usado o cancelado).",
      };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "invitation",
      entityId: data.id,
      action: "invitation.regenerated",
      payload: { email: data.email, role: data.role, full_name: data.full_name },
    });

    revalidatePath("/dashboard/miembros");

    return {
      success: true,
      invitation: {
        link: await invitationLink(token),
        email: data.email,
        fullName: data.full_name,
        role: data.role as ClubRole,
        expiresAt,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo generar el link.",
    };
  }
}

/** Cancela una invitación abierta: su link deja de servir. */
export async function revokeInvitationAction(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  const parsedId = z.string().uuid("Invitación inválida.").safeParse(invitationId);
  if (!parsedId.success) {
    return { success: false, error: "Invitación inválida." };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { data, error } = await supabase
      .from("club_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id, email, full_name, role")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: "No se encontró la invitación (puede que ya la hayan usado o cancelado).",
      };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "invitation",
      entityId: data.id,
      action: "invitation.revoked",
      payload: { email: data.email, role: data.role, full_name: data.full_name },
    });

    revalidatePath("/dashboard/miembros");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo cancelar la invitación.",
    };
  }
}

export async function updateMemberRoleAction(
  membershipId: string,
  role: ClubRole
): Promise<{ success: boolean; error?: string }> {
  const parsed = memberRoleSchema.safeParse({ role });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Rol inválido.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { data: target } = await supabase
      .from("memberships")
      .select("id, user_id, role")
      .eq("id", membershipId)
      .eq("club_id", clubId)
      .single();

    if (!target) {
      return { success: false, error: "No se encontró al miembro." };
    }

    // Evitar que el último admin se degrade a sí mismo.
    if (target.user_id === user!.id && parsed.data.role !== "admin") {
      const { count } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("role", "admin");

      if ((count ?? 0) <= 1) {
        return {
          success: false,
          error: "No podés quitarte el rol de administrador: sos el único admin del club.",
        };
      }
    }

    const { error } = await supabase
      .from("memberships")
      .update({ role: parsed.data.role })
      .eq("id", membershipId)
      .eq("club_id", clubId);

    if (error) {
      return { success: false, error: "No se pudo actualizar el rol." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "member",
      entityId: target.user_id,
      action: "member.role_updated",
      payload: { role: parsed.data.role },
    });

    revalidatePath("/dashboard/miembros");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "No se pudo actualizar el rol.",
    };
  }
}

export async function removeMemberAction(
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;

    const { data: target } = await supabase
      .from("memberships")
      .select("id, user_id")
      .eq("id", membershipId)
      .eq("club_id", clubId)
      .single();

    if (!target) {
      return { success: false, error: "No se encontró al miembro." };
    }

    if (target.user_id === user!.id) {
      return {
        success: false,
        error: "No podés eliminarte a vos mismo del club.",
      };
    }

    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("id", membershipId)
      .eq("club_id", clubId);

    if (error) {
      return { success: false, error: "No se pudo eliminar al miembro." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "member",
      entityId: target.user_id,
      action: "member.removed",
    });

    revalidatePath("/dashboard/miembros");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "No se pudo eliminar al miembro.",
    };
  }
}
