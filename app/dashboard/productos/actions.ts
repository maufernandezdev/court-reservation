"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { subscriptionMessage } from "@/lib/subscription";
import { productSchema, type ProductInput } from "@/lib/cash";

type Result = { success: boolean; error?: string };

const NAME_TAKEN = "Ya hay un producto con ese nombre.";
const idSchema = z.string().uuid();

function fail(err: unknown, fallback: string): Result {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

function refresh() {
  revalidatePath("/dashboard/productos");
  revalidatePath("/dashboard/caja");
}

/** Alta o cambio de un producto del catálogo (nombre y precio). Solo el admin. */
export async function saveProductAction(input: ProductInput, id?: string): Promise<Result> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  if (id !== undefined && !idSchema.safeParse(id).success) return { success: false, error: "Producto inválido." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { name, price } = parsed.data;

    const query = id
      ? supabase
          .from("products")
          .update({ name, price, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("club_id", clubId)
      : supabase.from("products").insert({ club_id: clubId, name, price, created_by: user!.id });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) {
      return { success: false, error: error.code === "23505" ? NAME_TAKEN : subscriptionMessage(error, "No se pudo guardar el producto.") };
    }
    if (!data) return { success: false, error: "El producto no existe." };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "product",
      entityId: data.id,
      action: id ? "product.updated" : "product.created",
      payload: { name, price },
    });
    refresh();
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo guardar el producto.");
  }
}

/** Deja de ofrecer un producto (o lo vuelve a ofrecer). No se borra: las ventas viejas lo nombran. */
export async function setProductActiveAction(id: string, active: boolean): Promise<Result> {
  if (!idSchema.safeParse(id).success || typeof active !== "boolean") return { success: false, error: "Producto inválido." };

  try {
    const { supabase, user, membership } = await requireRole("admin");
    const clubId = membership!.club_id;
    const { data, error } = await supabase
      .from("products")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("club_id", clubId)
      .select("id, name, price")
      .maybeSingle();
    if (error) return { success: false, error: subscriptionMessage(error, "No se pudo cambiar el producto.") };
    if (!data) return { success: false, error: "El producto no existe." };

    await writeAudit(supabase, {
      clubId,
      actorId: user!.id,
      entity: "product",
      entityId: data.id,
      action: "product.updated",
      payload: { name: data.name, price: data.price, active },
    });
    refresh();
    return { success: true };
  } catch (err) {
    return fail(err, "No se pudo cambiar el producto.");
  }
}
