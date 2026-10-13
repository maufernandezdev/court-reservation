"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Court } from "@/lib/courts";
import type {
  AuditEntry,
  ClubSettings,
  Payment,
  PaymentMethod,
  Reservation,
} from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import { depositFor, formatMoney } from "@/lib/pricing";
import { useSportPrices } from "@/hooks/use-sport-prices";
import { cancellationOutcome } from "@/lib/cancellation";
import {
  applyCreditAction,
  cancelReservationAction,
  registerPaymentAction,
} from "@/app/dashboard/reservas/actions";

export type MemberLite = { user_id: string; full_name: string; email: string };

const DEFAULT_SETTINGS = { cancel_window_hours: 24, late_penalty_percent: 50 };

type UseReservationDetailArgs = {
  /** Se recarga al abrir y cada vez que cambia la reserva (id o `updated_at`). */
  open: boolean;
  reservation: Reservation | null;
  courts: Court[];
  membership: Membership;
  onSaved: (reservation: Reservation) => void;
  onCancelled: (reservation: Reservation) => void;
  /** Se llama después de cancelar con éxito (ej. cerrar el diálogo). */
  onClosed?: () => void;
};

/**
 * Lógica del detalle de un turno: cobros, saldo a favor, cancelación con
 * política de penalidad, restricciones del profesor e historial. La usan el
 * diálogo, el panel lateral de la planilla y la hoja del celular.
 */
export function useReservationDetail({
  open,
  reservation,
  courts,
  membership,
  onSaved,
  onCancelled,
  onClosed,
}: UseReservationDetailArgs) {
  const supabase = createClient();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [credit, setCredit] = useState<number | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { prices } = useSportPrices();
  const court = reservation
    ? (courts.find((c) => c.id === reservation.court_id) ?? null)
    : null;
  // Valor fijado en el turno; la seña sale de la configuración del tipo de cancha.
  const slotPrice = reservation ? Number(reservation.price) : 0;
  const deposit = court ? depositFor(prices[court.type], slotPrice) : 0;

  const isCancelled = reservation?.status === "cancelled";
  const depositPaid = payments
    .filter((p) => p.kind === "seña" && !p.released)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = payments
    .filter((p) => !p.released)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, slotPrice - totalPaid);

  const loadExtras = useCallback(async () => {
    if (!reservation) return;
    setIsLoadingExtras(true);

    const [{ data: paymentsData }, { data: auditData }, { data: membersData }] =
      await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .eq("club_id", membership.club_id)
          .eq("reservation_id", reservation.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("audit_log")
          .select("*")
          .eq("club_id", membership.club_id)
          .eq("entity", "reservation")
          .eq("entity_id", reservation.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("memberships")
          .select("user_id, full_name, email")
          .eq("club_id", membership.club_id),
      ]);

    setPayments((paymentsData ?? []) as Payment[]);
    setAudit((auditData ?? []) as AuditEntry[]);
    setMembers((membersData ?? []) as MemberLite[]);

    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("club_id", membership.club_id)
      .maybeSingle();
    setSettings((settingsData as ClubSettings | null) ?? null);

    if (reservation.phone.trim()) {
      const { data: creditData } = await supabase
        .from("credit_balances")
        .select("amount")
        .eq("club_id", membership.club_id)
        .eq("customer_phone", reservation.phone.trim())
        .maybeSingle();
      setCredit(creditData ? Number(creditData.amount) : 0);
    } else {
      setCredit(null);
    }

    setIsLoadingExtras(false);
  }, [supabase, reservation, membership.club_id]);

  // Reseteo y carga al abrir o cuando la reserva cambia (cobro, edición).
  useEffect(() => {
    if (!open) return;
    setCancelReason("");
    setCancelConfirmOpen(false);
    setPaymentMethod("efectivo");

    if (reservation) {
      loadExtras();
    } else {
      setPayments([]);
      setCredit(null);
      setAudit([]);
      setSettings(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id, reservation?.updated_at]);

  // ¿La cancelación sería tardía según la política del club?
  const cancelWindowHours =
    settings?.cancel_window_hours ?? DEFAULT_SETTINGS.cancel_window_hours;
  const latePenaltyPercent =
    settings?.late_penalty_percent ?? DEFAULT_SETTINGS.late_penalty_percent;
  // Mismo criterio que la Server Action: hora del club (Argentina, UTC-3).
  const hoursUntilStart = reservation
    ? (new Date(`${reservation.date}T${reservation.time}:00-03:00`).getTime() -
        Date.now()) /
      3_600_000
    : Infinity;
  const wouldBeLate = hoursUntilStart < cancelWindowHours;

  const profesorBlocked =
    membership.role === "profesor" && wouldBeLate && !isCancelled;
  const profesorMoneyBlocked =
    membership.role === "profesor" && !isCancelled && totalPaid > 0;

  /** Montos de la cancelación según la política (para mostrarlos antes de confirmar). */
  const cancelOutcome = cancellationOutcome({
    late: wouldBeLate,
    slotPrice,
    paid: totalPaid,
    penaltyPercent: latePenaltyPercent,
  });

  const cancelConsequence = (): string => {
    if (!wouldBeLate) {
      return totalPaid > 0
        ? `Es una cancelación en término: los ${formatMoney(totalPaid)} cobrados se liberan como saldo a favor del cliente.`
        : "Es una cancelación en término: no se generan penalidades.";
    }
    const parts: string[] = [];
    if (cancelOutcome.retained > 0) parts.push(`se retienen ${formatMoney(cancelOutcome.retained)}`);
    if (cancelOutcome.released > 0) parts.push(`se liberan ${formatMoney(cancelOutcome.released)} como saldo a favor`);
    if (cancelOutcome.debt > 0) parts.push(`queda una deuda de ${formatMoney(cancelOutcome.debt)}`);
    return `Es una cancelación tardía (penalidad del ${latePenaltyPercent}% = ${formatMoney(cancelOutcome.penalty)}): ${parts.join(", ") || "sin movimientos de dinero"}.`;
  };

  const registerPayment = async (kind: "seña" | "total") => {
    if (!reservation) return;
    const { success, error, reservation: updated } = await registerPaymentAction(
      reservation.id,
      { kind, method: paymentMethod }
    );
    if (success) {
      toast.success(kind === "seña" ? "Seña registrada" : "Pago total registrado");
      onSaved(updated!);
      await loadExtras();
    } else {
      toast.error(error ?? "No se pudo registrar el cobro");
    }
  };

  const applyCredit = async () => {
    if (!reservation) return;
    const { success, error, reservation: updated } = await applyCreditAction(
      reservation.id
    );
    if (success) {
      toast.success("Saldo a favor aplicado");
      onSaved(updated!);
      await loadExtras();
    } else {
      toast.error(error ?? "No se pudo aplicar el saldo");
    }
  };

  const cancel = async () => {
    if (!reservation) return;
    setIsCancelling(true);
    const { success, error, reservation: updated } = await cancelReservationAction(
      reservation.id,
      cancelReason
    );
    setIsCancelling(false);
    setCancelConfirmOpen(false);

    if (success) {
      toast.success("Reserva cancelada");
      onCancelled(updated!);
      onClosed?.();
    } else {
      toast.error(error ?? "No se pudo cancelar la reserva");
    }
  };

  const actorName = (actorId: string | null) => {
    if (!actorId) return "Sistema";
    const member = members.find((m) => m.user_id === actorId);
    return member?.full_name || member?.email || "Usuario";
  };

  return {
    court,
    payments,
    credit,
    audit,
    settings,
    isLoadingExtras,
    reload: loadExtras,
    slotPrice,
    deposit,
    depositPaid,
    totalPaid,
    remaining,
    isCancelled,
    cancelWindowHours,
    latePenaltyPercent,
    hoursUntilStart,
    wouldBeLate,
    profesorBlocked,
    profesorMoneyBlocked,
    cancelOutcome,
    cancelConsequence,
    paymentMethod,
    setPaymentMethod,
    cancelReason,
    setCancelReason,
    cancelConfirmOpen,
    setCancelConfirmOpen,
    isCancelling,
    registerPayment,
    applyCredit,
    cancel,
    actorName,
  };
}

export type ReservationDetail = ReturnType<typeof useReservationDetail>;
