import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubDataSeed } from "@/components/club/club-data-provider";
import { queryClubSettings, queryCourts, queryProfes, querySportPrices } from "@/lib/club-data";

/**
 * Datos del club que usan Hoy y la Planilla (canchas, políticas, precios y profes),
 * pedidos en paralelo en el servidor para sembrar `ClubDataProvider`.
 */
export async function loadClubDataSeed(
  supabase: SupabaseClient,
  clubId: string
): Promise<ClubDataSeed & { courtsError: string }> {
  const [courtsResult, settings, sportPrices, profes] = await Promise.all([
    queryCourts(supabase, clubId),
    queryClubSettings(supabase, clubId),
    querySportPrices(supabase, clubId),
    queryProfes(supabase, clubId),
  ]);
  return {
    clubId,
    courts: courtsResult.courts,
    courtsError: courtsResult.error,
    settings,
    sportPrices,
    profes,
  };
}
