"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { normalizeDni, socioSchema, type SocioInput } from "@/lib/socios";

type Result = { success: boolean; error?: string };

const DNI_TAKEN = "Ese DNI ya está cargado en otro socio del club.";

function clean(input: SocioInput) {
  return {
    full_name: input.full_name.trim(),
    dni: normalizeDni(input.dni.trim()),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

/** Alta de socio (admin y operador). */
export async function createSocioAction(input: SocioInput): Promise<Result> {
  const parsed = socioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const { supabase, user, membership } = await requireRole("operador");
    const clubId = membership!.club_id;
    const values = clean(parsed.data);

    const { data, error } = await supabase
      .from("socios")
      .insert({ ...values, club_id: clubId, created_by: user!.id })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.code === "23505" ? DNI_TAKEN : "No se pudo guardar el socio." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "socio",
      entityId: data.id,
      action: "socio.created",
      payload: { full_name: values.full_name, dni: values.dni },
    });

    revalidatePath("/dashboard/socios");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo guardar el socio." };
  }
}

/** Edición de socio (admin y operador). */
export async function updateSocioAction(id: string, input: SocioInput): Promise<Result> {
  const parsedId = z.string().uuid().safeParse(id);
  const parsed = socioSchema.safeParse(input);
  if (!parsedId.success) return { success: false, error: "Socio inválido." };
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const { supabase, user, membership } = await requireRole("operador");
    const clubId = membership!.club_id;
    const values = clean(parsed.data);

    const { data, error } = await supabase
      .from("socios")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.code === "23505" ? DNI_TAKEN : "No se pudo actualizar el socio.",
      };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "socio",
      entityId: parsedId.data,
      action: "socio.updated",
      payload: { full_name: values.full_name, dni: values.dni },
    });

    revalidatePath("/dashboard/socios");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo actualizar el socio." };
  }
}

/** Baja lógica: el socio deja de aparecer, sus turnos pasados conservan el nombre. */
export async function removeSocioAction(id: string): Promise<Result> {
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { success: false, error: "Socio inválido." };

  try {
    const { supabase, user, membership } = await requireRole("operador");
    const clubId = membership!.club_id;

    const { data, error } = await supabase
      .from("socios")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .is("deleted_at", null)
      .select("full_name")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "No se pudo dar de baja el socio." };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "socio",
      entityId: parsedId.data,
      action: "socio.removed",
      payload: { full_name: data.full_name },
    });

    revalidatePath("/dashboard/socios");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo dar de baja el socio." };
  }
}
