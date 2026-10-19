import { ShieldAlert } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import {
  BILLING_CYCLE_LABELS,
  PAYMENT_STATUS_LABELS,
  STATE_LABELS,
  courtsLimitText,
  fetchSubscriptionInfo,
  formatDate,
  pluralDays,
  type Plan,
  type SubscriptionPayment,
  type SubscriptionState,
} from "@/lib/subscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { PlansSection } from "@/components/subscription/plans-section";

const STATE_BADGE: Record<SubscriptionState, "default" | "secondary" | "destructive" | "outline"> = {
  trial: "secondary",
  active: "default",
  grace: "outline",
  expired: "destructive",
  none: "outline",
};

export default async function SuscripcionPage() {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>Solo los administradores pueden ver la suscripción del club.</AlertDescription>
      </Alert>
    );
  }

  const [info, { data: plansData }, { data: paymentsData }] = await Promise.all([
    fetchSubscriptionInfo(supabase, membership.club_id),
    supabase.from("plans").select("*").order("sort_order"),
    supabase
      .from("subscription_payments")
      .select("id, plan_code, amount, billing_cycle, period_start, period_end, status, paid_at")
      .eq("club_id", membership.club_id)
      .order("paid_at", { ascending: false }),
  ]);
  const plans = (plansData ?? []) as Plan[];
  const payments = (paymentsData ?? []) as SubscriptionPayment[];
  const planNames = new Map(plans.map((p) => [p.code, p.name]));

  const state = info?.state ?? "none";
  const daysLeft = info?.days_left ?? 0;

  let deadline = "";
  if (info && state !== "none") {
    if (state === "trial") deadline = `La prueba gratis termina el ${formatDate(info.ends_on)}`;
    else if (state === "active") deadline = `El período pagado vence el ${formatDate(info.ends_on)}`;
    else deadline = `Venció el ${formatDate(info.ends_on)}`;
  }

  let remaining = "";
  if (state === "trial" || state === "active") {
    remaining = daysLeft === 0 ? "Vence hoy" : `Faltan ${pluralDays(daysLeft)}`;
  } else if (state === "grace") {
    remaining = `Te ${info?.grace_days_left === 1 ? "queda" : "quedan"} ${pluralDays(info?.grace_days_left ?? 0)} de gracia antes del modo solo lectura`;
  } else if (state === "expired") {
    remaining = "El club está en modo solo lectura hasta regularizar el pago";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Suscripción" description="El plan de tu club, su vencimiento y el historial de pagos." />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{info?.plan_name ? `Plan ${info.plan_name}` : "Sin plan"}</CardTitle>
            <Badge variant={STATE_BADGE[state]}>{STATE_LABELS[state]}</Badge>
          </div>
          {deadline && <CardDescription>{deadline}</CardDescription>}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Vencimiento</dt>
              <dd className="font-medium">{formatDate(info?.ends_on)}</dd>
              {remaining && <dd className="text-muted-foreground">{remaining}</dd>}
            </div>
            <div>
              <dt className="text-muted-foreground">Canchas</dt>
              <dd className="font-medium">
                {info?.courts_used ?? 0} {info?.courts_limit != null ? `de ${info.courts_limit}` : "en uso"}
              </dd>
              <dd className="text-muted-foreground">{courtsLimitText(info?.courts_limit ?? null)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ciclo de pago</dt>
              <dd className="font-medium capitalize">{BILLING_CYCLE_LABELS[info?.billing_cycle ?? "monthly"]}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <PlansSection plans={plans} currentPlanCode={info?.plan_code ?? null} initialCycle={info?.billing_cycle ?? "monthly"} />

      <section aria-label="Historial de pagos" className="space-y-3">
        <h2 className="text-lg font-semibold">Historial de pagos</h2>
        {payments.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">
            Todavía no hay pagos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.paid_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</TableCell>
                    <TableCell>{planNames.get(p.plan_code) ?? p.plan_code}</TableCell>
                    <TableCell>
                      {formatDate(p.period_start)} al {formatDate(p.period_end)}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(Number(p.amount))}</TableCell>
                    <TableCell>{PAYMENT_STATUS_LABELS[p.status]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
