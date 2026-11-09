import type { SupabaseClient } from "@supabase/supabase-js";
import type { Court } from "@/lib/courts";
import type { DayPayment } from "@/lib/daily-overview";
import type { SportPrices } from "@/lib/pricing";
import { DEFAULT_NIGHT_STARTS_AT } from "@/lib/pricing";
import { DEFAULT_CLUB_HOURS, normalizeTime } from "@/lib/availability";
import { RESERVATION_SELECT, type ClubSettings, type Reservation } from "@/lib/reservations";
import { ensureFixedReservations } from "@/lib/series";

/**
 * Consultas de datos del club que comparten el servidor (carga inicial de las páginas)
 * y el cliente (recargas, cambio de fecha). Reciben el cliente de Supabase de cada lado;
 * en los dos casos rige RLS.
 */

export const DEFAULT_CLUB_SETTINGS = {
  cancel_window_hours: 24,
  late_penalty_percent: 50,
  tournament_duration_minutes: 90,
  night_starts_at: DEFAULT_NIGHT_STARTS_AT,
  open_time: DEFAULT_CLUB_HOURS.open_time,
  close_time: DEFAULT_CLUB_HOURS.close_time,
};

export type LoadedClubSettings = Pick<ClubSettings, keyof typeof DEFAULT_CLUB_SETTINGS>;

export type Profe = { user_id: string; name: string; color: string | null };

export async function queryCourts(
  supabase: SupabaseClient,
  clubId: string
): Promise<{ courts: Court[]; error: string }> {
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", clubId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  return {
    courts: (data ?? []) as Court[],
    error: error ? "No se pudieron cargar las canchas." : "",
  };
}

export async function queryClubSettings(
  supabase: SupabaseClient,
  clubId: string
): Promise<LoadedClubSettings> {
  const { data } = await supabase
    .from("settings")
    .select(
      "cancel_window_hours, late_penalty_percent, tournament_duration_minutes, night_starts_at, open_time, close_time"
    )
    .eq("club_id", clubId)
    .maybeSingle();
  if (!data) return DEFAULT_CLUB_SETTINGS;
  return {
    ...DEFAULT_CLUB_SETTINGS,
    ...data,
    night_starts_at: normalizeTime(data.night_starts_at),
    open_time: normalizeTime(data.open_time),
    close_time: normalizeTime(data.close_time),
  };
}

export async function querySportPrices(
  supabase: SupabaseClient,
  clubId: string
): Promise<SportPrices[]> {
  const { data } = await supabase.from("sport_prices").select("*").eq("club_id", clubId);
  return (data ?? []) as SportPrices[];
}

export async function queryProfes(supabase: SupabaseClient, clubId: string): Promise<Profe[]> {
  const { data } = await supabase
    .from("memberships")
    .select("user_id, full_name, email, color")
    .eq("club_id", clubId)
    .eq("role", "profesor");
  return ((data ?? []) as { user_id: string; full_name: string; email: string; color: string | null }[])
    .map((m) => ({ user_id: m.user_id, name: m.full_name || m.email, color: m.color }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Turnos de una fecha. Antes genera las fechas de los turnos fijos que falten hasta ese día. */
export async function queryReservations(
  supabase: SupabaseClient,
  clubId: string,
  date: string,
  todayKey?: string
): Promise<{ reservations: Reservation[]; error: string }> {
  await ensureFixedReservations(supabase, clubId, date, todayKey);
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("club_id", clubId)
    .eq("date", date)
    .order("time", { ascending: true });
  return {
    reservations: (data ?? []) as Reservation[],
    error: error ? "No se pudieron cargar las reservas." : "",
  };
}

/** Cobros (no liberados) de un conjunto de turnos. */
export async function queryDayPayments(
  supabase: SupabaseClient,
  clubId: string,
  reservationIds: string[]
): Promise<DayPayment[]> {
  if (reservationIds.length === 0) return [];
  const { data } = await supabase
    .from("payments")
    .select("reservation_id, amount, released")
    .eq("club_id", clubId)
    .in("reservation_id", reservationIds)
    .eq("released", false);
  return (data ?? []) as DayPayment[];
}

/** Clave estable de un conjunto de ids (para saber si los cobros ya corresponden a esos turnos). */
export function idsKey(ids: string[]): string {
  return [...ids].sort().join(",");
}
