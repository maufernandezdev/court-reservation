"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { subscriptionMessage } from "@/lib/subscription";
import { payeeSchema, type PayeeInput } from "@/lib/cash";

type Result = { success: boolean; error?: string };

const NAME_TAKEN = "Ya hay alguien con ese nombre en la lista.";
const idSchema = z.string().uuid();

function fail(err: unknown, fallback: string): Result {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

function refresh() {
  revalidatePath("/dashboard/proveedores");
  revalidatePath("/dashboard/equipo");
  revalidatePath("/dashboard/caja");
}

/** Alta o cambio de un proveedor o de una persona del equipo sin acceso a la app. Solo el admin. */
export async function savePayeeAction(input: PayeeInput, id?: string): Promise<Result> {
  const parsed = payeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  if (id !== undefined && !idSchema.safeParse(id).success) return { success: false, error: "Registro inválido." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { name, kind } = parsed.data;

    const query = id
      ? supabase
          .from("cash_payees")
          .update({ name, kind, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("club_id", clubId)
      : supabase.from("cash_payees").insert({ club_id: clubId, name, kind, created_by: user!.id });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) {
      return { success: false, error: error.code === "23505" ? NAME_TAKEN : subscriptionMessage(error, "No se pudo guardar.") };
    }
    if (!data) return { success: false, error: "El registro no existe." };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "payee",
      entityId: data.id,
      action: id ? "payee.updated" : "payee.created",
      payload: { name, kind },
    });
    refresh();
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo guardar.");
  }
}

/** Saca a alguien de la lista (o lo vuelve a sumar). No se borra: las salidas viejas lo nombran. */
export async function setPayeeActiveAction(id: string, active: boolean): Promise<Result> {
  if (!idSchema.safeParse(id).success || typeof active !== "boolean") return { success: false, error: "Registro inválido." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { data, error } = await supabase
      .from("cash_payees")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("club_id", clubId)
      .select("id, name, kind")
      .maybeSingle();
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo guardar.") };
    if (!data) return { success: false, error: "El registro no existe." };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "payee",
      entityId: data.id,
      action: "payee.updated",
      payload: { name: data.name, kind: data.kind, active },
    });
    refresh();
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo guardar.");
  }
}
