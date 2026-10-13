import type { SupabaseClient } from "@supabase/supabase-js";

/** Hasta cuánto adelante se generan fechas de turnos fijos al consultar. */
const MAX_DAYS_AHEAD = 366;

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Antes de leer los turnos de una fecha, genera las fechas de los turnos fijos que
 * todavía no existen hasta ese día (idempotente en la base). Las fechas pasadas no
 * se generan y el límite es un año adelante.
 */
export async function ensureFixedReservations(
  supabase: SupabaseClient,
  clubId: string,
  dateKey: string
): Promise<void> {
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + MAX_DAYS_AHEAD);
  if (dateKey < localKey(today) || dateKey > localKey(limit)) return;

  const { error } = await supabase.rpc("ensure_series_until", {
    p_club_id: clubId,
    p_until: dateKey,
  });
  if (error) console.error("No se pudieron generar los turnos fijos:", error.message);
}
