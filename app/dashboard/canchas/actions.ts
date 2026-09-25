"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { courtSchema, type CourtInput } from "@/lib/courts";

export async function createCourtAction(
  input: CourtInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = courtSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No hay sesión activa." };
  }

  const { error } = await supabase
    .from("courts")
    .insert({
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: "No se pudo crear la cancha." };
  }

  revalidatePath("/dashboard/canchas");
  revalidatePath("/dashboard/reservas");

  return { success: true };
}

export async function updateCourtAction(
  id: string,
  input: CourtInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = courtSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No hay sesión activa." };
  }

  const { error } = await supabase
    .from("courts")
    .update({
      name: parsed.data.name.trim(),
      type: parsed.data.type,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: "No se pudo actualizar la cancha." };
  }

  revalidatePath("/dashboard/canchas");
  revalidatePath("/dashboard/reservas");

  return { success: true };
}

// Baja lógica: la cancha queda en la base (con sus reservas) pero no se muestra.
export async function deactivateCourtAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No hay sesión activa." };
  }

  const { error } = await supabase
    .from("courts")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: "No se pudo eliminar la cancha." };
  }

  revalidatePath("/dashboard/canchas");
  revalidatePath("/dashboard/reservas");

  return { success: true };
}
