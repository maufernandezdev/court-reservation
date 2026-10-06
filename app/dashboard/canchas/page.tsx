import { LandPlot, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { normalizeTime } from "@/lib/availability";
import { COURT_TYPE_LABELS, type Court, type CourtType } from "@/lib/courts";
import { formatMoney } from "@/lib/pricing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NewCourtDialog } from "@/components/courts/new-court-dialog";
import { CourtCardActions } from "@/components/courts/court-card-actions";

export default async function CanchasPage() {
  const { membership } = await getSessionContext();

  // Configurar canchas (precios, horarios, señas) es exclusivo del admin.
  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Solo los administradores pueden gestionar las canchas del club.
        </AlertDescription>
      </Alert>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  const courts = (data ?? []).map((court) => ({
    ...(court as Court),
    open_time: normalizeTime((court as Court).open_time),
    close_time: normalizeTime((court as Court).close_time),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Canchas</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná las canchas, precios, horarios y señas de tu club
          </p>
        </div>
        <NewCourtDialog triggerLabel="Nueva cancha" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            No se pudieron cargar las canchas.
          </AlertDescription>
        </Alert>
      )}

      {courts.length === 0 ? (
        <Card className="flex min-h-[30vh] flex-col items-center justify-center text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LandPlot className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Todavía no tenés canchas</CardTitle>
            <CardDescription>
              Creá tu primera cancha para empezar a gestionar las reservas de
              tu club.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewCourtDialog triggerLabel="Crear tu primera cancha" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <Card key={court.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{court.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">
                      {COURT_TYPE_LABELS[court.type as CourtType]}
                    </Badge>
                    <CourtCardActions court={court} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Precio por hora</span>
                  <span className="font-medium">
                    {court.price_per_hour > 0
                      ? formatMoney(court.price_per_hour)
                      : "Sin configurar"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Turnos</span>
                  <span className="font-medium">
                    {court.slot_duration} min · {court.open_time} a{" "}
                    {court.close_time}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Seña</span>
                  <span className="font-medium">
                    {court.deposit_enabled
                      ? court.deposit_type === "percent"
                        ? `${court.deposit_value}% del turno`
                        : formatMoney(court.deposit_value)
                      : "No requiere"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
