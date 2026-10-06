"use server";

import { revalidatePath } from "next/cache";
import {
  memberInviteSchema,
  memberRoleSchema,
  type MemberInviteInput,
} from "@/lib/members";
import type { ClubRole } from "@/lib/roles";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function inviteMemberAction(
  input: MemberInviteInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = memberInviteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const ownerId = membership!.owner_id;

    const { data: invitedUserId, error: rpcError } = await supabase.rpc(
      "find_user_id_by_email",
      { p_email: parsed.data.email }
    );

    if (rpcError || !invitedUserId) {
      return {
        success: false,
        error:
          "No encontramos ningún usuario con ese email. La persona debe registrarse primero desde la pantalla de registro.",
      };
    }

    if (invitedUserId === user!.id) {
      return {
        success: false,
        error: "Ya sos miembro del club.",
      };
    }

    const { error } = await supabase.from("memberships").insert({
      owner_id: ownerId,
      user_id: invitedUserId,
      role: parsed.data.role,
      full_name: parsed.data.full_name.trim(),
      email: parsed.data.email.trim().toLowerCase(),
    });

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "Ese usuario ya es miembro del club.",
        };
      }
      return { success: false, error: "No se pudo agregar al miembro." };
    }

    await writeAudit(supabase, {
      ownerId,
      actorId: user!.id,
      entity: "member",
      entityId: invitedUserId,
      action: "member.invited",
      payload: { email: parsed.data.email, role: parsed.data.role },
    });

    revalidatePath("/dashboard/miembros");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "No se pudo agregar al miembro.",
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
    const ownerId = membership!.owner_id;

    const { data: target } = await supabase
      .from("memberships")
      .select("id, user_id, role")
      .eq("id", membershipId)
      .eq("owner_id", ownerId)
      .single();

    if (!target) {
      return { success: false, error: "No se encontró al miembro." };
    }

    // Evitar que el último admin se degrade a sí mismo.
    if (target.user_id === user!.id && parsed.data.role !== "admin") {
      const { count } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId)
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
      .eq("owner_id", ownerId);

    if (error) {
      return { success: false, error: "No se pudo actualizar el rol." };
    }

    await writeAudit(supabase, {
      ownerId,
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
    const ownerId = membership!.owner_id;

    const { data: target } = await supabase
      .from("memberships")
      .select("id, user_id")
      .eq("id", membershipId)
      .eq("owner_id", ownerId)
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
      .eq("owner_id", ownerId);

    if (error) {
      return { success: false, error: "No se pudo eliminar al miembro." };
    }

    await writeAudit(supabase, {
      ownerId,
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
