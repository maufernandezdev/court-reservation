"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CourtTypeFilter } from "@/components/court-type-filter";
import { useCourts } from "@/hooks/use-courts";
import { COURT_TYPE_LABELS } from "@/lib/courts";
import { useReservations } from "@/hooks/use-reservations";
import type { CourtTypeFilterValue } from "@/components/court-type-filter";
import { LandPlot, RefreshCw, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Franja "en curso": bloque de 1h alineado a la grilla (desde 09:00)
// que contiene la hora actual. Fuera de la grilla (antes de 09:00 o
// después del bloque 22:00) no hay franja en curso.
function currentTimeSlot(now: Date): string | null {
  const hour = now.getHours();
  if (hour < 9 || hour > 22) return null;
  return `${String(hour).padStart(2, "0")}:00`;
}

function slotEnd(slot: string): string {
  const hour = Number(slot.slice(0, 2)) + 1;
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function DashboardIndexPage() {
  const [now, setNow] = useState(() => new Date());
  const [courtTypeFilter, setCourtTypeFilter] =
    useState<CourtTypeFilterValue>("all");

  const {
    courts,
    isLoading: isLoadingCourts,
    error: courtsError,
    refetch: refetchCourts,
  } = useCourts();

  const todayKey = useMemo(() => formatDateKey(now), [now]);
  const slot = useMemo(() => currentTimeSlot(now), [now]);

  const {
    reservations,
    isLoading: isLoadingReservations,
    error: reservationsError,
    refetch: refetchReservations,
  } = useReservations(todayKey);

  const visibleCourts = useMemo(
    () =>
      courtTypeFilter === "all"
        ? courts
        : courts.filter((court) => court.type === courtTypeFilter),
    [courts, courtTypeFilter]
  );

  // Join en memoria: reserva del bloque actual por cancha.
  const occupancy = useMemo(() => {
    if (!slot) return new Map<string, (typeof reservations)[number]>();
    return new Map(
      reservations
        .filter((r) => r.time === slot)
        .map((r) => [r.court_id, r])
    );
  }, [reservations, slot]);

  const handleRefresh = () => {
    setNow(new Date());
    refetchCourts();
    refetchReservations();
  };

  const isLoading = isLoadingCourts || isLoadingReservations;
  const loadError = courtsError || reservationsError;

  return (
    <AuthGuard>
      <div className="space-y-6">
        <PageHeader
          title="Hoy en el club"
          eyebrow={
            <>
              {now.toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              ·{" "}
              {now.toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {slot ? ` · Franja ${slot} – ${slotEnd(slot)}` : ""}
            </>
          }
          actions={
          <div className="flex items-center gap-2">
            <CourtTypeFilter
              value={courtTypeFilter}
              onChange={setCourtTypeFilter}
            />
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refrescar
            </Button>
          </div>
          }
        />

        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : courts.length === 0 ? (
          <Card className="flex min-h-[30vh] flex-col items-center justify-center text-center">
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <LandPlot className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>Todavía no tenés canchas</CardTitle>
              <CardDescription>
                Creá tu primera cancha para ver acá la ocupación de tu club.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/canchas">Crear tu primera cancha</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCourts.map((court) => {
              const reservation = occupancy.get(court.id);
              return (
                <Card key={court.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{court.name}</CardTitle>
                      <Badge variant="secondary">
                        {COURT_TYPE_LABELS[court.type]}
                      </Badge>
                    </div>
                    <CardDescription>
                      {reservation ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {reservation.customer_name}
                        </span>
                      ) : (
                        "Sin reserva en la franja actual"
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reservation && slot ? (
                      <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Ocupada · {slot} – {slotEnd(slot)}
                      </Badge>
                    ) : (
                      <Badge className="bg-green-600 text-white hover:bg-green-600/90">
                        Disponible
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
