import { getSessionContext } from "@/lib/auth";
import { clubTodayKey } from "@/lib/club-time";
import { queryReservations } from "@/lib/club-data";
import { loadClubDataSeed } from "@/lib/club-data-server";
import { ClubDataProvider } from "@/components/club/club-data-provider";
import { ScheduleView } from "@/components/reservations/schedule-view";

export const metadata = { title: "Planilla" };

/** Planilla: los datos del club y los turnos de hoy llegan desde el servidor. */
export default async function SchedulePage() {
  const { supabase, membership } = await getSessionContext();
  // El layout ya redirige si no hay sesión o club.
  if (!membership) return null;

  const clubId = membership.club_id;
  const today = clubTodayKey();
  const [seed, reservationsResult] = await Promise.all([
    loadClubDataSeed(supabase, clubId),
    queryReservations(supabase, clubId, today, today),
  ]);

  return (
    <ClubDataProvider value={seed}>
      <ScheduleView initialReservations={{ date: today, ...reservationsResult }} />
    </ClubDataProvider>
  );
}
