import { ShieldAlert } from "lucide-react";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentMethod } from "@/lib/reservations";
import { PageHeader } from "@/components/shell/page-header";
import { CashDateNav } from "@/components/cash/cash-date-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Caja" };

const CLUB_TZ = "America/Argentina/Buenos_Aires";
/** El club opera en Argentina (UTC-3, sin horario de verano). */
const CLUB_OFFSET = "-03:00";

const KIND_LABELS: Record<Payment["kind"], string> = {
  seña: "Seña",
  total: "Cobro",
  saldo: "Saldo a favor aplicado",
};

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: CLUB_TZ });
}

function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function dayTitle(key: string, today: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return key === today ? `Hoy · ${label}` : label;
}

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/**
 * Caja del día: lo cobrado en el club según los cobros registrados en la planilla.
 * Ingresa plata: señas y cobros (aunque después hayan pasado a saldo a favor).
 * No ingresa plata: el saldo a favor aplicado (ya estaba en la caja).
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo los administradores pueden ver la caja del club.</AlertDescription>
      </Alert>
    );
  }

  const today = todayKey();
  const raw = await searchParams;
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => value <= today)
    .catch(today)
    .parse(typeof raw.fecha === "string" ? raw.fecha : today);

  const clubId = membership.club_id;
  const [{ data: paymentsData, error }, { data: membersData }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("club_id", clubId)
      .gte("created_at", `${date}T00:00:00${CLUB_OFFSET}`)
      .lt("created_at", `${nextDayKey(date)}T00:00:00${CLUB_OFFSET}`)
      .order("created_at", { ascending: false }),
    supabase.from("memberships").select("user_id, full_name, email").eq("club_id", clubId),
  ]);

  const payments = (paymentsData ?? []) as Payment[];
  const reservationIds = [...new Set(payments.map((p) => p.reservation_id))];
  const { data: reservationsData } = reservationIds.length
    ? await supabase
        .from("reservations")
        .select("id, customer_name, date, time, court_id, courts(name)")
        .eq("club_id", clubId)
        .in("id", reservationIds)
    : { data: [] };

  type ReservationRow = {
    id: string;
    customer_name: string;
    date: string;
    time: string;
    courts: { name: string } | null;
  };
  const reservationById = new Map(
    ((reservationsData ?? []) as unknown as ReservationRow[]).map((r) => [r.id, r])
  );
  const memberName = new Map(
    ((membersData ?? []) as { user_id: string; full_name: string; email: string }[]).map((m) => [
      m.user_id,
      m.full_name || m.email,
    ])
  );

  // Plata que entró: señas y cobros. El saldo aplicado no es plata nueva.
  const income = payments.filter((p) => p.kind !== "saldo");
  const total = income.reduce((sum, p) => sum + Number(p.amount), 0);
  const byMethod = (["efectivo", "transferencia", "otro"] as PaymentMethod[]).map((method) => ({
    method,
    amount: income.filter((p) => p.method === method).reduce((sum, p) => sum + Number(p.amount), 0),
  }));
  const creditApplied = payments
    .filter((p) => p.kind === "saldo")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caja"
        eyebrow={dayTitle(date, today)}
        description="Lo cobrado en el día según los cobros registrados en la planilla."
        actions={<CashDateNav date={date} today={today} />}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>No se pudo cargar la caja.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
        <section className="flex flex-col gap-1 rounded-2xl bg-ball p-5 text-ball-foreground">
          <h2 className="text-sm font-medium">Total cobrado</h2>
          <strong className="font-display text-[34px] leading-tight font-extrabold font-stretch-[125%]">
            {formatMoney(total)}
          </strong>
          <span className="text-sm">
            {income.length} {income.length === 1 ? "cobro" : "cobros"}
          </span>
        </section>
        {byMethod.map(({ method, amount }) => (
          <section key={method} className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
            <h2 className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[method]}</h2>
            <strong className="font-mono text-2xl font-bold">{formatMoney(amount)}</strong>
          </section>
        ))}
      </div>

      {creditApplied > 0 && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Además se aplicaron <strong className="text-foreground">{formatMoney(creditApplied)}</strong> de
          saldo a favor (plata que ya estaba en la caja, no suma al total).
        </p>
      )}

      <section aria-labelledby="movimientos" className="overflow-hidden rounded-2xl border bg-card">
        <h2 id="movimientos" className="border-b px-5 py-3.5 text-base font-bold">
          Movimientos
        </h2>
        {payments.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">No hubo cobros este día.</p>
        ) : (
          <ol>
            {payments.map((payment) => {
              const reservation = reservationById.get(payment.reservation_id);
              const who = payment.created_by ? memberName.get(payment.created_by) : undefined;
              return (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-muted px-5 py-3.5 first:border-t-0"
                >
                  <time
                    dateTime={payment.created_at}
                    className="w-12 font-mono text-sm text-muted-foreground"
                  >
                    {new Date(payment.created_at).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: CLUB_TZ,
                    })}
                  </time>
                  <span className="flex min-w-0 flex-[1_1_260px] flex-col">
                    <strong className="truncate text-[15px]">
                      {KIND_LABELS[payment.kind]}
                      {reservation ? ` · ${reservation.customer_name}` : ""}
                    </strong>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {reservation
                        ? `${reservation.courts?.name ?? "Cancha"} · turno del ${shortDate(reservation.date)} ${reservation.time}`
                        : "Turno"}
                      {who ? ` · cobró ${who}` : ""}
                    </span>
                  </span>
                  {payment.kind === "saldo" ? (
                    <Badge variant="outline">No suma</Badge>
                  ) : (
                    <Badge variant="outline">{PAYMENT_METHOD_LABELS[payment.method]}</Badge>
                  )}
                  {payment.released && (
                    <Badge variant="outline" className="border-line/40 text-line">
                      Pasó a saldo a favor
                    </Badge>
                  )}
                  <strong className="ml-auto font-mono text-base">{formatMoney(Number(payment.amount))}</strong>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
