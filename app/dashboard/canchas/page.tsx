import { LandPlot, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { DEFAULT_CLUB_HOURS, DEFAULT_DURATION_MINUTES, normalizeTime } from "@/lib/availability";
import { COURT_TYPE_LABELS, type Court, type CourtType } from "@/lib/courts";
import {
  DEFAULT_NIGHT_STARTS_AT,
  depositFor,
  formatMoney,
  pricesBySport,
  quotePriceFor,
  type SportPrices,
} from "@/lib/pricing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PricesDialog } from "@/components/prices/prices-dialog";
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

  // Llega desde el alta del club: se abre la bienvenida y, con "Siguiente", los precios iniciales.
  const { alta } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", membership.club_id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  const { data: pricesData } = await supabase
    .from("sport_prices")
    .select("*")
    .eq("club_id", membership.club_id);
  const priceRows = (pricesData ?? []) as SportPrices[];
  const prices = pricesBySport(priceRows);

  const { data: settingsData } = await supabase
    .from("settings")
    .select("night_starts_at, open_time, close_time")
    .eq("club_id", membership.club_id)
    .maybeSingle();
  const nightStartsAt = normalizeTime(settingsData?.night_starts_at ?? DEFAULT_NIGHT_STARTS_AT);
  const hours = {
    open_time: normalizeTime(settingsData?.open_time ?? DEFAULT_CLUB_HOURS.open_time),
    close_time: normalizeTime(settingsData?.close_time ?? DEFAULT_CLUB_HOURS.close_time),
  };

  const courts = (data ?? []) as Court[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canchas"
        description="Tus canchas de un vistazo. Los precios, el horario de la noche y las señas se ajustan desde el botón Precios."
        actions={
          <>
            <PricesDialog
              clubName={membership.club.name}
              sports={[...new Set(courts.map((c) => c.type))]}
              rows={priceRows}
              nightStartsAt={nightStartsAt}
              hours={hours}
              onboarding={alta === "1"}
            />
            <NewCourtDialog triggerLabel="Nueva cancha" />
          </>
        }
      />

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
                    {COURT_TYPE_LABELS[court.type as CourtType]}
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
              {(() => {
                const courtPrices = prices[court.type];
                const publicDay = quotePriceFor(courtPrices, "standard", DEFAULT_DURATION_MINUTES, false);
                const publicNight = quotePriceFor(courtPrices, "standard", DEFAULT_DURATION_MINUTES, true);
                const profeDay = quotePriceFor(courtPrices, "profe", DEFAULT_DURATION_MINUTES, false);
                const profeNight = quotePriceFor(courtPrices, "profe", DEFAULT_DURATION_MINUTES, true);
                const publicDeposit = depositFor(courtPrices, "standard", publicDay);
                const profeDeposit = depositFor(courtPrices, "profe", profeDay);
                return (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Hora de día</dt>
                      <dd className="mt-0.5 font-mono font-semibold">
                        {publicDay > 0 ? formatMoney(publicDay) : "Sin precio"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Hora de noche</dt>
                      <dd className="mt-0.5 font-mono font-semibold">
                        {publicNight > 0 ? formatMoney(publicNight) : "Sin precio"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Hora de profe</dt>
                      <dd className="mt-0.5 font-mono font-semibold">
                        {formatMoney(profeDay)}
                        {profeNight !== profeDay && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {formatMoney(profeNight)} de noche
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Seña</dt>
                      <dd className="mt-0.5 font-semibold">
                        {publicDeposit === 0 && profeDeposit === 0 && "No pide"}
                        {publicDeposit > 0 && (
                          <span className="block">
                            <span className="font-mono">{formatMoney(publicDeposit)}</span> público
                          </span>
                        )}
                        {profeDeposit > 0 && (
                          <span className="block">
                            <span className="font-mono">{formatMoney(profeDeposit)}</span> profe
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                );
              })()}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
