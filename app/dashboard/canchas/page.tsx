import { LandPlot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { COURT_TYPE_LABELS, type Court, type CourtType } from "@/lib/courts";
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  const courts = (data ?? []) as Court[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canchas</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná las canchas de tu club
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
