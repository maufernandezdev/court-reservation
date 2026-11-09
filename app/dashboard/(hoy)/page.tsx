import { getSessionContext } from "@/lib/auth";
import { clubTodayKey } from "@/lib/club-time";
import { idsKey, queryDayPayments, queryReservations } from "@/lib/club-data";
import { loadClubDataSeed } from "@/lib/club-data-server";
import { ClubDataProvider } from "@/components/club/club-data-provider";
import { TodayView } from "@/components/today/today-view";

export const metadata = { title: "Hoy" };

/** Hoy: los datos del día llegan en el HTML; el resto es interactivo en `TodayView`. */
export default async function TodayPage() {
  const { supabase, membership } = await getSessionContext();
  // El layout ya redirige si no hay sesión o club.
  if (!membership) return null;

  const clubId = membership.club_id;
  const today = clubTodayKey();
  const [{ courtsError, ...seed }, reservationsResult] = await Promise.all([
    loadClubDataSeed(supabase, clubId),
    queryReservations(supabase, clubId, today, today),
  ]);
  const ids = reservationsResult.reservations.map((r) => r.id);
  const payments = await queryDayPayments(supabase, clubId, ids);

  return (
    <ClubDataProvider value={seed}>
      <TodayView
        initialReservations={{ date: today, ...reservationsResult }}
        initialPayments={{ idsKey: idsKey(ids), payments }}
        courtsError={courtsError}
      />
    </ClubDataProvider>
  );
}
