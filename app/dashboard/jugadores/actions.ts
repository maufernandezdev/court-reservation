"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { normalizeDni, playerSchema, type PlayerInput } from "@/lib/players";
import { subscriptionMessage } from "@/lib/subscription";

type Result = { success: boolean; error?: string };

const DNI_TAKEN = "Ese DNI ya está cargado en otro jugador del club.";

function clean(input: PlayerInput) {
  return {
    full_name: input.full_name.trim(),
    dni: normalizeDni(input.dni.trim()),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

/** Alta de jugador (cualquier miembro; el profe carga a sus alumnos). */
export async function createPlayerAction(input: PlayerInput): Promise<Result> {
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const { supabase, user, membership } = await requireRole("profesor");
    const clubId = membership!.club_id;
    const values = clean(parsed.data);

    const { data, error } = await supabase
      .from("players")
      .insert({ ...values, club_id: clubId, created_by: user!.id })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.code === "23505" ? DNI_TAKEN : subscriptionMessage(error, "No se pudo guardar el jugador.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "player",
      entityId: data.id,
      action: "player.created",
      payload: { full_name: values.full_name, dni: values.dni },
    });

    revalidatePath("/dashboard/jugadores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo guardar el jugador." };
  }
}

/** Edición de jugador (admin y operador, o el profe si lo agregó él). */
export async function updatePlayerAction(id: string, input: PlayerInput): Promise<Result> {
  const parsedId = z.string().uuid().safeParse(id);
  const parsed = playerSchema.safeParse(input);
  if (!parsedId.success) return { success: false, error: "Jugador inválido." };
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const { supabase, user, membership } = await requireRole("profesor");
    const clubId = membership!.club_id;
    const values = clean(parsed.data);

    let query = supabase
      .from("players")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .is("deleted_at", null);
    // El profe solo modifica a los que agregó él (la base también lo exige).
    if (membership!.role === "profesor") query = query.eq("created_by", user!.id);
    const { data, error } = await query.select("id").maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.code === "23505" ? DNI_TAKEN : subscriptionMessage(error, "No se pudo actualizar el jugador."),
      };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "player",
      entityId: parsedId.data,
      action: "player.updated",
      payload: { full_name: values.full_name, dni: values.dni },
    });

    revalidatePath("/dashboard/jugadores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo actualizar el jugador." };
  }
}

/** Baja lógica: el jugador deja de aparecer, sus turnos pasados conservan el nombre. */
export async function removePlayerAction(id: string): Promise<Result> {
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { success: false, error: "Jugador inválido." };

  try {
    const { supabase, user, membership } = await requireRole("profesor");
    const clubId = membership!.club_id;

    let query = supabase
      .from("players")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("club_id", clubId)
      .is("deleted_at", null);
    if (membership!.role === "profesor") query = query.eq("created_by", user!.id);
    const { data, error } = await query.select("full_name").maybeSingle();

    if (error || !data) {
      return { success: false, error: subscriptionMessage(error, "No se pudo dar de baja el jugador.") };
    }

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "player",
      entityId: parsedId.data,
      action: "player.removed",
      payload: { full_name: data.full_name },
    });

    revalidatePath("/dashboard/jugadores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo dar de baja el jugador." };
  }
}
