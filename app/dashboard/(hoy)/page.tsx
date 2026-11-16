import { getSessionContext } from "@/lib/auth";
import { clubTodayKey } from "@/lib/club-time";
import { idsKey, queryDayPayments, queryReservations } from "@/lib/club-data";
import { loadClubDataSeed } from "@/lib/club-data-server";
import { ClubDataProvider } from "@/components/club/club-data-provider";
import { TodayView } from "@/components/today/today-view";
import { ApprovalRequests, type ApprovalRequest } from "@/components/today/approval-requests";
import { RESERVATION_SELECT, RESERVATION_SOURCE, type Reservation } from "@/lib/reservations";
import { reservationTitle } from "@/lib/reservation-tone";

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
  const isAdmin = membership.role === "admin";
  // Horarios con confirmación: el admin ve todos los pedidos; el resto, los suyos (y los rechazados).
  let requestsQuery = supabase
    .from(RESERVATION_SOURCE)
    .select(RESERVATION_SELECT)
    .eq("club_id", clubId)
    .gte("date", today)
    .order("date")
    .order("time")
    .limit(50);
  requestsQuery = isAdmin
    ? requestsQuery.eq("status", "pending_approval")
    : requestsQuery.eq("created_by", membership.user_id).in("status", ["pending_approval", "rejected"]);
  const [payments, { data: requestRows }, { data: members }] = await Promise.all([
    queryDayPayments(supabase, clubId, ids),
    requestsQuery,
    supabase.from("memberships").select("user_id, full_name, email").eq("club_id", clubId),
  ]);
  const courtName = new Map((seed.courts ?? []).map((c) => [c.id, c.name]));
  const memberName = new Map(
    ((members ?? []) as { user_id: string; full_name: string; email: string }[]).map((m) => [
      m.user_id,
      m.full_name || m.email,
    ])
  );
  const requests: ApprovalRequest[] = ((requestRows ?? []) as unknown as Reservation[]).map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    title: reservationTitle(r),
    courtName: courtName.get(r.court_id) ?? "Cancha",
    status: r.status === "rejected" ? "rejected" : "pending_approval",
    requestedBy: (r.created_by && memberName.get(r.created_by)) || "alguien del equipo",
    reason: r.cancel_reason,
  }));

  return (
    <ClubDataProvider value={seed}>
      <TodayView
        initialReservations={{ date: today, ...reservationsResult }}
        initialPayments={{ idsKey: idsKey(ids), payments }}
        courtsError={courtsError}
        approvals={
          <ApprovalRequests
            requests={requests}
            isAdmin={isAdmin}
            clubName={membership.club.name}
            clubWhatsapp={seed.settings?.whatsapp || null}
          />
        }
      />
    </ClubDataProvider>
  );
}
