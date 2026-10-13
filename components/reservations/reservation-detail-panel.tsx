"use client";

import Link from "next/link";
import { History, Loader2, MessageCircle, Pencil, Wallet, X, Repeat, Trophy } from "lucide-react";
import {
  sortedParticipants,
  RESERVATION_KIND_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Reservation,
} from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import { formatMoney } from "@/lib/pricing";
import { minutesToTime, timeToMinutes } from "@/lib/availability";
import { COURT_TYPE_LABELS } from "@/lib/courts";
import type { ReservationDetail } from "@/hooks/use-reservation-detail";
import { describeAuditEntry } from "@/lib/audit";
import {
  RESERVATION_TONE_LABELS,
  reservationLook,
  reservationTitle,
  toneFor,
} from "@/lib/reservation-tone";
import { FALLBACK_PROFE_COLOR } from "@/lib/profe-colors";
import { useProfeColors } from "@/hooks/use-profes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Números argentinos sin código de país: 54 + 9 (celular).
  return `https://wa.me/${digits.startsWith("54") ? digits : `549${digits}`}`;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type ReservationDetailPanelProps = {
  reservation: Reservation;
  membership: Membership;
  detail: ReservationDetail;
  /** Botón "Editar" (abre el formulario de datos del turno). */
  onEdit?: () => void;
  /** Botón de cierre del panel lateral. */
  onClose?: () => void;
  /** Muestra encabezado propio (estado + nombre). En el diálogo ya hay título. */
  showHeader?: boolean;
};

/** "sábados" para una fecha YYYY-MM-DD. */
function weekdayPlural(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const name = new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long" });
  return name.endsWith("s") ? name : `${name}s`;
}

/** Detalle del turno: datos, cobros, cancelación según la política e historial. */
export function ReservationDetailPanel({
  reservation,
  membership,
  detail,
  onEdit,
  onClose,
  showHeader = true,
}: ReservationDetailPanelProps) {
  const tone = toneFor(reservation);
  const profeColors = useProfeColors();
  const {
    court,
    isLoadingExtras,
    payments,
    slotPrice,
    deposit,
    depositPaid,
    totalPaid,
    remaining,
    credit,
    isCancelled,
    cancelWindowHours,
    latePenaltyPercent,
    wouldBeLate,
    profesorBlocked,
    profesorMoneyBlocked,
    audit,
  } = detail;
  const canCharge = membership.role !== "profesor";
  const end = minutesToTime(
    timeToMinutes(reservation.time) + reservation.duration_minutes
  );
  const wa = whatsappHref(reservation.phone);

  return (
    <div className="flex flex-col gap-5">
      {showHeader && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge variant={tone} className="px-2.5 py-1 text-[13px]">
                {RESERVATION_TONE_LABELS[tone]}
              </Badge>
              {reservation.kind !== "standard" && (
                <Badge
                  className={cn(
                    "px-2.5 py-1 text-[13px]",
                    reservation.kind === "torneo" ? "bg-line text-line-foreground" : "text-white"
                  )}
                  style={
                    reservation.kind === "profe"
                      ? { backgroundColor: (reservation.profe_user_id && profeColors.get(reservation.profe_user_id)) || FALLBACK_PROFE_COLOR }
                      : undefined
                  }
                >
                  {reservation.kind === "torneo" && <Trophy aria-hidden="true" />}
                  {RESERVATION_KIND_LABELS[reservation.kind]}
                </Badge>
              )}
              {reservation.series_id && (
                <Badge variant="outline" className="px-2.5 py-1 text-[13px]">
                  <Repeat aria-hidden="true" />
                  Fijo
                </Badge>
              )}
            </span>
            {onClose && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Cerrar detalle"
              >
                <X />
              </Button>
            )}
          </div>
          <h2 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-balance font-stretch-[115%]">
            {reservationTitle(reservation)}
          </h2>
          {(() => {
            const people = sortedParticipants(reservation).map((p) => p.name);
            if (reservation.kind === "profe") {
              const students = people.slice(1);
              return students.length > 0 ? (
                <p className="text-[15px] text-muted-foreground">Alumnos: {students.join(", ")}</p>
              ) : null;
            }
            return reservation.kind === "standard" && people.length > 1 ? (
              <p className="text-[15px] text-muted-foreground">Juegan: {people.join(", ")}</p>
            ) : null;
          })()}
        </div>
      )}

      {reservation.phone && (
        <div className="-mt-2 flex flex-wrap items-center gap-3 text-[15px]">
          {wa ? (
            <Link
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-success underline-offset-4 hover:underline"
            >
              <MessageCircle className="size-4" />
              {reservation.phone}
            </Link>
          ) : (
            <span className="text-muted-foreground">{reservation.phone}</span>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Cancha</dt>
          <dd className="mt-0.5 font-semibold">
            {court ? `${court.name} · ${COURT_TYPE_LABELS[court.type]}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Horario</dt>
          <dd className="mt-0.5 font-mono font-semibold">
            {reservation.time} – {end}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="mt-0.5 font-semibold">
            {formatDate(reservation.date)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Duración</dt>
          <dd className="mt-0.5 font-semibold">{reservation.duration_minutes} min</dd>
        </div>
      </dl>

      {isLoadingExtras ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-xl bg-background p-3.5 text-sm">
            <div className="flex justify-between">
              <span>Valor del turno</span>
              <span className="font-mono font-semibold">{formatMoney(slotPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cobrado</span>
              <span className="font-mono font-semibold">{formatMoney(totalPaid)}</span>
            </div>
            {!isCancelled && (
              <div className="flex justify-between border-t pt-2 text-base">
                <strong>Falta cobrar</strong>
                <strong className="font-mono">{formatMoney(remaining)}</strong>
              </div>
            )}
            {payments.length > 0 && (
              <ul className="flex flex-col gap-1 border-t pt-2 text-[13px] text-muted-foreground">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-2">
                    <span>
                      {payment.kind === "seña"
                        ? "Seña"
                        : payment.kind === "total"
                          ? "Pago"
                          : "Saldo a favor"}{" "}
                      · {PAYMENT_METHOD_LABELS[payment.method]}
                      {payment.released && " · liberado"}
                    </span>
                    <span className={cn("font-mono", payment.released && "line-through")}>
                      {formatMoney(Number(payment.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isCancelled && canCharge && reservation.payment_status !== "pagada" && (
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold" id="payment-method-label">
                Método de cobro
              </span>
              <ToggleGroup
                type="single"
                variant="segmented"
                spacing={1}
                value={detail.paymentMethod}
                onValueChange={(v) => v && detail.setPaymentMethod(v as PaymentMethod)}
                aria-labelledby="payment-method-label"
                className="grid w-full grid-cols-3 rounded-lg bg-muted p-1"
              >
                {PAYMENT_METHODS.map((method) => (
                  <ToggleGroupItem key={method} value={method} className="h-9 w-full">
                    {PAYMENT_METHOD_LABELS[method]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Button size="lg" onClick={() => detail.registerPayment("total")}>
                {totalPaid > 0
                  ? `Cobrar saldo de ${formatMoney(remaining)}`
                  : `Cobrar total de ${formatMoney(slotPrice)}`}
              </Button>
              {deposit > 0 && depositPaid === 0 && totalPaid === 0 && (
                <Button variant="outline" onClick={() => detail.registerPayment("seña")}>
                  Cobrar solo la seña ({formatMoney(deposit)})
                </Button>
              )}
              {credit !== null && credit > 0 && remaining > 0 && (
                <Button variant="outline" onClick={detail.applyCredit}>
                  <Wallet />
                  Aplicar saldo a favor ({formatMoney(credit)})
                </Button>
              )}
            </div>
          )}

          {reservation.series_id && !isCancelled && (
            <div className="flex flex-col gap-2.5 rounded-xl border p-3.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Repeat aria-hidden="true" className="size-4" />
                Turno fijo · todos los {weekdayPlural(reservation.date)} a las {reservation.time}
              </span>
              {(membership.role !== "profesor" || reservation.profe_user_id === membership.user_id) && (
                <Button variant="outline" onClick={() => detail.setEndSeriesOpen(true)}>
                  Dar de baja el fijo desde esta fecha
                </Button>
              )}
              <p className="text-[13px] leading-snug text-pretty text-muted-foreground">
                Para liberar solo esta fecha, cancelá el turno como cualquier otro.
              </p>
            </div>
          )}

          <AlertDialog open={detail.endSeriesOpen} onOpenChange={detail.setEndSeriesOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Dar de baja el turno fijo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Desde el {formatDate(reservation.date)} no se reserva más los {weekdayPlural(reservation.date)} a las{" "}
                  {reservation.time}. Se liberan las fechas sin cobros; las que ya tienen cobros quedan
                  activas para que las canceles a mano. Las fechas anteriores no cambian.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Mejor no</AlertDialogCancel>
                <AlertDialogAction
                  onClick={detail.endSeries}
                  disabled={detail.isEndingSeries}
                  variant="destructive"
                >
                  {detail.isEndingSeries ? "Dando de baja…" : "Dar de baja"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!isCancelled && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {onEdit && (
                  <Button variant="outline" onClick={onEdit}>
                    <Pencil />
                    Editar
                  </Button>
                )}
                <Button
                  variant="outline"
                  className={cn(
                    "border-destructive/30 text-destructive hover:bg-danger-soft hover:text-danger-soft-foreground",
                    !onEdit && "col-span-2"
                  )}
                  disabled={profesorBlocked || profesorMoneyBlocked}
                  onClick={() => detail.setCancelConfirmOpen(true)}
                >
                  Cancelar turno
                </Button>
              </div>
              <p className="text-[13px] leading-snug text-pretty text-muted-foreground">
                {wouldBeLate
                  ? `Faltan menos de ${cancelWindowHours} h: si se cancela ahora es fuera de término (penalidad del ${latePenaltyPercent}% del turno).`
                  : `Se puede cancelar en término hasta ${cancelWindowHours} h antes del turno.`}
              </p>
              {profesorBlocked && (
                <Alert>
                  <AlertDescription>
                    Este turno entra en la ventana de penalidad (menos de{" "}
                    {cancelWindowHours} h). Como profesor no podés cancelarlo:
                    consultá con un administrador.
                  </AlertDescription>
                </Alert>
              )}
              {profesorMoneyBlocked && (
                <Alert>
                  <AlertDescription>
                    Este turno tiene cobros registrados. Como profesor no podés
                    cancelarlo: la devolución o retención la gestiona un
                    administrador u operador.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isCancelled && (
            <Alert>
              <AlertDescription>
                Turno cancelado
                {reservation.late_cancel ? " fuera de término" : " en término"}
                {reservation.cancel_reason && ` · Motivo: ${reservation.cancel_reason}`}
              </AlertDescription>
            </Alert>
          )}

          {membership.role === "admin" && audit.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t pt-4">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <History className="size-4" />
                Historial
              </span>
              <ol className="flex flex-col gap-2 text-[13px]">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex gap-2.5">
                    <span className="font-mono whitespace-nowrap text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                    <span>
                      <strong className="font-semibold">
                        {detail.actorName(entry.actor_id)}
                      </strong>{" "}
                      {/* Sin contexto del turno: ya se está viendo ese turno. */}
                      {describeAuditEntry({ ...entry, payload: { ...entry.payload, customer_name: undefined, date: undefined, time: undefined } })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <CancelConfirmDialog reservation={reservation} detail={detail} />
    </div>
  );
}

/** Confirmación de cancelación: consecuencia en $ según la política + motivo. */
export function CancelConfirmDialog({
  reservation,
  detail,
}: {
  reservation: Reservation;
  detail: ReservationDetail;
}) {
  const { cancelOutcome, wouldBeLate, court } = detail;
  const tone = toneFor(reservation);
  const profeColors = useProfeColors();
  const look = reservationLook(
    reservation,
    reservation.profe_user_id ? profeColors.get(reservation.profe_user_id) : null
  );
  return (
    <AlertDialog
      open={detail.cancelConfirmOpen}
      onOpenChange={detail.setCancelConfirmOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl font-extrabold tracking-[-0.02em] font-stretch-[120%]">
            Cancelar turno
          </AlertDialogTitle>
          <AlertDialogDescription>{detail.cancelConsequence()}</AlertDialogDescription>
        </AlertDialogHeader>

        <div
          className={cn("flex items-center gap-3 rounded-xl p-3.5", look.className, "no-underline")}
          style={look.style}
        >
          <strong className="font-mono text-xl">{reservation.time}</strong>
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-base">{reservationTitle(reservation)}</strong>
            <span className="text-[13px] opacity-85">
              {court?.name} · {formatDate(reservation.date)} · {reservation.duration_minutes} min ·{" "}
              {RESERVATION_TONE_LABELS[tone]}
            </span>
          </span>
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl p-3.5 text-sm",
            wouldBeLate ? "bg-danger-soft" : "bg-success-soft"
          )}
        >
          <span
            className={cn(
              "w-fit rounded-md px-2 py-0.5 text-xs font-bold text-white",
              wouldBeLate ? "bg-danger-soft-foreground" : "bg-success"
            )}
          >
            {wouldBeLate ? "Fuera de término" : "En término"}
          </span>
          {cancelOutcome.retained > 0 && (
            <div className="flex justify-between">
              <span>Queda para el club</span>
              <strong className="font-mono">{formatMoney(cancelOutcome.retained)}</strong>
            </div>
          )}
          {cancelOutcome.released > 0 && (
            <div className="flex justify-between">
              <span>Saldo a favor del cliente</span>
              <strong className="font-mono">{formatMoney(cancelOutcome.released)}</strong>
            </div>
          )}
          {cancelOutcome.debt > 0 && (
            <div className="flex justify-between">
              <span>El cliente queda debiendo</span>
              <strong className="font-mono">{formatMoney(cancelOutcome.debt)}</strong>
            </div>
          )}
          {cancelOutcome.retained + cancelOutcome.released + cancelOutcome.debt === 0 && (
            <span>Sin movimientos de dinero.</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
          <Textarea
            id="cancel-reason"
            value={detail.cancelReason}
            onChange={(e) => detail.setCancelReason(e.target.value)}
            placeholder="Ej. lluvia, pedido del jugador…"
            rows={2}
          />
          <span className="text-[13px] text-muted-foreground">
            Queda en Actividad con tu nombre y la hora.
          </span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Mejor no</AlertDialogCancel>
          <AlertDialogAction
            onClick={detail.cancel}
            disabled={detail.isCancelling}
            variant="destructive"
          >
            {detail.isCancelling ? "Cancelando…" : "Confirmar cancelación"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
