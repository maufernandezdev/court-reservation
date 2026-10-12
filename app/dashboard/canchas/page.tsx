import Link from "next/link";
import { LandPlot, ShieldAlert, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { normalizeTime } from "@/lib/availability";
import { COURT_TYPE_LABELS, type Court, type CourtType } from "@/lib/courts";
import { formatMoney, getSlotPrice } from "@/lib/pricing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NewCourtDialog } from "@/components/courts/new-court-dialog";
import { CourtCardActions } from "@/components/courts/court-card-actions";
import { PageHeader } from "@/components/shell/page-header";

export default async function CanchasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  // Llega desde el alta del club (paso 3 de 3).
  const { alta } = await searchParams;
  const isOnboarding = alta === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", membership.club_id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  const courts = (data ?? []).map((court) => ({
    ...(court as Court),
    open_time: normalizeTime((court as Court).open_time),
    close_time: normalizeTime((court as Court).close_time),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canchas"
        description="Precio, duración del turno, horario y seña de cada cancha."
        actions={<NewCourtDialog triggerLabel="Nueva cancha" />}
      />

      {isOnboarding && (
        <Alert className="border-ball bg-ball text-ball-foreground">
          <Sparkles className="size-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-ball-foreground">
            <span>
              <strong className="font-mono">PASO 3 DE 3</strong> · Tu club ya está creado.
              Las canchas arrancan en $0 con turnos de 60 minutos: editá cada una (menú ⋮) para
              definir precio, duración y seña.
            </span>
            <Link href="/dashboard" className="font-semibold underline underline-offset-4">
              Listo, ir a Hoy
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            No se pudieron cargar las canchas.
          </AlertDescription>
        </Alert>
      )}

      {courts.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <LandPlot className="size-6 text-muted-foreground" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Todavía no tenés canchas</h2>
            <p className="text-muted-foreground">
              Creá tu primera cancha para empezar a gestionar las reservas de tu club.
            </p>
          </div>
          <NewCourtDialog triggerLabel="Crear tu primera cancha" />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3.5">
          {courts.map((court) => (
            <article
              key={court.id}
              aria-labelledby={`court-${court.id}`}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-[18px]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-xs text-muted-foreground uppercase">
                    {COURT_TYPE_LABELS[court.type as CourtType]} · {court.slot_duration} min
                  </span>
                  <h2
                    id={`court-${court.id}`}
                    className="truncate font-display text-[22px] font-extrabold tracking-[-0.02em] font-stretch-[115%]"
                  >
                    {court.name}
                  </h2>
                </div>
                <CourtCardActions court={court} />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                <div>
                  <dt className="text-[13px] text-muted-foreground">Precio por hora</dt>
                  <dd className="mt-0.5 font-mono font-semibold">
                    {court.price_per_hour > 0
                      ? formatMoney(court.price_per_hour)
                      : "Sin configurar"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-muted-foreground">Turno</dt>
                  <dd className="mt-0.5 font-semibold">
                    {court.slot_duration} min · {formatMoney(getSlotPrice(court, court.slot_duration))}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-muted-foreground">Horario</dt>
                  <dd className="mt-0.5 font-mono font-semibold">
                    {court.open_time} – {court.close_time}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-muted-foreground">Seña</dt>
                  <dd className="mt-0.5 font-semibold">
                    {court.deposit_enabled
                      ? court.deposit_type === "percent"
                        ? `${court.deposit_value} %`
                        : formatMoney(court.deposit_value)
                      : "No pide"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
