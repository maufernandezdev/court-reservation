"use client";

import { History, Loader2, Wallet } from "lucide-react";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Reservation,
} from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import { formatMoney } from "@/lib/pricing";
import type { ReservationDetail } from "@/hooks/use-reservation-detail";
import { RESERVATION_TONE_LABELS, toneFor } from "@/lib/reservation-tone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReservationDetailPanelProps = {
  reservation: Reservation;
  membership: Membership;
  detail: ReservationDetail;
};

/** Cobros, saldo a favor, cancelación e historial de un turno. */
export function ReservationDetailPanel({
  reservation,
  membership,
  detail,
}: ReservationDetailPanelProps) {
  const tone = toneFor(reservation);
  const {
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
    profesorBlocked,
    profesorMoneyBlocked,
    audit,
  } = detail;

  if (isLoadingExtras) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Valor del turno: <strong>{formatMoney(slotPrice)}</strong>
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            Cobrado: <strong>{formatMoney(totalPaid)}</strong>
          </span>
          <span className="text-muted-foreground">·</span>
          <Badge variant={tone}>{RESERVATION_TONE_LABELS[tone]}</Badge>
        </div>

        {payments.length > 0 && (
          <ul className="space-y-1 text-sm">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span>
                  {payment.kind === "seña"
                    ? "Seña"
                    : payment.kind === "total"
                      ? "Pago total"
                      : "Saldo a favor"}{" "}
                  · {PAYMENT_METHOD_LABELS[payment.method]}
                </span>
                <span className="flex items-center gap-2">
                  <strong>{formatMoney(Number(payment.amount))}</strong>
                  {payment.released && <Badge variant="outline">Liberada</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!isCancelled && (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="payment-method">Método</Label>
                <Select
                  value={detail.paymentMethod}
                  onValueChange={(value) =>
                    detail.setPaymentMethod(value as PaymentMethod)
                  }
                >
                  <SelectTrigger id="payment-method" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {deposit > 0 && depositPaid === 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => detail.registerPayment("seña")}
                >
                  Cobrar seña ({formatMoney(deposit)})
                </Button>
              )}
              {reservation.payment_status !== "pagada" && (
                <Button type="button" onClick={() => detail.registerPayment("total")}>
                  Cobrar total ({formatMoney(slotPrice)})
                </Button>
              )}
            </div>

            {credit !== null && credit > 0 && remaining > 0 && (
              <Button type="button" variant="outline" onClick={detail.applyCredit}>
                <Wallet />
                Aplicar saldo a favor ({formatMoney(credit)})
              </Button>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Motivo de cancelación (opcional)</Label>
              <Textarea
                id="cancel-reason"
                value={detail.cancelReason}
                onChange={(e) => detail.setCancelReason(e.target.value)}
                placeholder="Ej. Lluvia, pedido del cliente..."
                rows={2}
              />

              {profesorBlocked && (
                <Alert>
                  <AlertDescription>
                    Este turno entra en la ventana de penalidad (menos de{" "}
                    {cancelWindowHours} hs de anticipación). Como profesor no
                    podés cancelarlo: consultá con un administrador.
                  </AlertDescription>
                </Alert>
              )}

              {profesorMoneyBlocked && (
                <Alert>
                  <AlertDescription>
                    Esta reserva tiene cobros registrados. Como profesor no
                    podés cancelarla: la devolución o retención de la plata la
                    gestiona un administrador u operador.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                variant="destructive"
                disabled={profesorBlocked || profesorMoneyBlocked}
                onClick={() => detail.setCancelConfirmOpen(true)}
              >
                Cancelar reserva
              </Button>
            </div>
          </>
        )}

        {isCancelled && (
          <Alert>
            <AlertDescription>
              Reserva cancelada
              {reservation.late_cancel ? " fuera de término" : " en término"}
              {reservation.cancel_reason && ` · Motivo: ${reservation.cancel_reason}`}
            </AlertDescription>
          </Alert>
        )}

        {membership.role === "admin" && audit.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <div className="flex items-center gap-2 text-sm font-medium">
              <History className="size-4" />
              Historial de acciones
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {audit.map((entry) => (
                <li key={entry.id}>
                  <span className="font-medium text-foreground">
                    {detail.actorName(entry.actor_id)}
                  </span>{" "}
                  {entry.action.replace(".", " ")}{" "}
                  {entry.payload &&
                    typeof entry.payload.amount === "number" &&
                    `(${formatMoney(entry.payload.amount)})`}
                  {" · "}
                  {new Date(entry.created_at).toLocaleString("es-AR")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CancelConfirmDialog detail={detail} />
    </>
  );
}

/** Confirmación de cancelación con la consecuencia según la política. */
export function CancelConfirmDialog({ detail }: { detail: ReservationDetail }) {
  return (
    <AlertDialog
      open={detail.cancelConfirmOpen}
      onOpenChange={detail.setCancelConfirmOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar la reserva?</AlertDialogTitle>
          <AlertDialogDescription>
            {detail.cancelConsequence()} ¿Confirmás la cancelación?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction
            onClick={detail.cancel}
            disabled={detail.isCancelling}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {detail.isCancelling ? "Cancelando..." : "Confirmar cancelación"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
