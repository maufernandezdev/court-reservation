import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave secreta del proyecto: saltea el RLS por completo.
 * Uso exclusivo para `auth.admin.createUser` al aceptar una invitación
 * (cuenta del invitado creada ya confirmada). No usar para leer ni escribir datos del club.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Falta configurar SUPABASE_SECRET_KEY en el servidor.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
