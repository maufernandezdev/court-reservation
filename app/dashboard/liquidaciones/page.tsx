import Link from "next/link";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { queryProfes } from "@/lib/club-data";
import { clubTodayKey } from "@/lib/club-time";
import { formatMoney } from "@/lib/pricing";
import { addDaysKey, loadProfeSettlements, shortDay, weekStart, type ProfeSettlement } from "@/lib/profe-settlement";
import { FALLBACK_PROFE_COLOR } from "@/lib/profe-colors";
import { PageHeader } from "@/components/shell/page-header";
import { SettleProfeDialog } from "@/components/settlements/settle-profe-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Liquidación de profes" };

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${shortDay(key)}`;
}

/**
 * Liquidación de profes: cada semana (lunes a domingo) el profe le paga al club los turnos de profe
 * que usó. El cobro entra a la caja del día en que se paga y los turnos quedan pagados.
 */
export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo los administradores cobran las liquidaciones de los profes.</AlertDescription>
      </Alert>
    );
  }

  const raw = await searchParams;
  const today = clubTodayKey();
  const currentWeek = weekStart(today);
  const from = weekStart(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .catch(currentWeek)
      .parse(typeof raw.semana === "string" ? raw.semana : currentWeek)
  );
  const to = addDaysKey(from, 6);
  const periodLabel = `Semana del ${shortDay(from)} al ${shortDay(to)}`;
  const weekHref = (key: string) => (key === currentWeek ? "/dashboard/liquidaciones" : `/dashboard/liquidaciones?semana=${key}`);

  const clubId = membership.club_id;
  let loadError = "";
  let settlements: ProfeSettlement[] = [];
  try {
    const profes = await queryProfes(supabase, clubId);
    settlements = await loadProfeSettlements(supabase, clubId, profes, from, to);
  } catch {
    loadError = "No se pudieron cargar los turnos de los profes.";
  }
  const totalDue = settlements.reduce((s, p) => s + p.due, 0);
  const totalPaid = settlements.reduce((s, p) => s + p.paid, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liquidación de profes"
        eyebrow={periodLabel}
        description="Lo que cada profe le paga al club por los turnos que usó en la semana."
        actions={
          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="icon" aria-label="Semana anterior">
              <Link href={weekHref(addDaysKey(from, -7))}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={weekHref(currentWeek)}>Esta semana</Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Semana siguiente">
              <Link href={weekHref(addDaysKey(from, 7))}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
        <section className="flex flex-col gap-1 rounded-2xl bg-ball p-5 text-ball-foreground">
          <h2 className="text-sm font-medium">Falta cobrar</h2>
          <strong className="font-mono text-3xl font-bold">{formatMoney(totalDue)}</strong>
          <span className="text-sm">{periodLabel}</span>
        </section>
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Ya cobrado</h2>
          <strong className="font-mono text-2xl font-bold">{formatMoney(totalPaid)}</strong>
        </section>
      </div>

      {settlements.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          No hay profes en el equipo. Sumalos en Equipo para liquidar sus turnos.
        </p>
      ) : (
        settlements.map((profe) => (
          <section key={profe.user_id} aria-label={profe.name} className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3.5">
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: profe.color ?? FALLBACK_PROFE_COLOR }}
              />
              <h2 className="min-w-0 flex-[1_1_160px] truncate text-base font-bold">{profe.name}</h2>
              <span className="text-sm text-muted-foreground">
                {profe.turns.length} {profe.turns.length === 1 ? "turno" : "turnos"} · {formatMoney(profe.total)}
              </span>
              {profe.due > 0 ? (
                <SettleProfeDialog
                  profeUserId={profe.user_id}
                  profeName={profe.name}
                  from={from}
                  to={to}
                  periodLabel={periodLabel}
                  due={profe.due}
                  turns={profe.turns.filter((t) => t.due > 0).length}
                />
              ) : profe.turns.length > 0 ? (
                <Badge variant="outline">Pagado</Badge>
              ) : null}
            </div>
            {profe.turns.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Sin turnos esta semana.</p>
            ) : (
              <ul>
                {profe.turns.map((turn) => (
                  <li
                    key={turn.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-muted px-5 py-2.5 text-[15px] first:border-t-0",
                      turn.due === 0 && "text-muted-foreground"
                    )}
                  >
                    <span className="w-24 font-mono text-sm">{dayLabel(turn.date)}</span>
                    <span className="w-14 font-mono text-sm">{turn.time}</span>
                    <span className="min-w-0 flex-[1_1_120px] truncate">{turn.courtName}</span>
                    {turn.due === 0 ? (
                      <Badge variant="outline">Pagado</Badge>
                    ) : turn.paid > 0 ? (
                      <Badge variant="outline">Pagó {formatMoney(turn.paid)}</Badge>
                    ) : null}
                    <span className="ml-auto font-mono">{formatMoney(turn.due > 0 ? turn.due : turn.price)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
