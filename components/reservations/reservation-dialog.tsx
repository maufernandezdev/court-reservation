"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  History,
  Loader2,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Court } from "@/lib/courts";
import {
  reservationInputSchema,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type AuditEntry,
  type Payment,
  type PaymentMethod,
  type Reservation,
  type ReservationInput,
  type ClubSettings,
} from "@/lib/reservations";
import type { Membership } from "@/lib/roles";
import { getCourtSlots, rangesOverlap, timeToMinutes } from "@/lib/availability";
import { formatMoney, getDepositAmount, getSlotPrice } from "@/lib/pricing";
import {
  applyCreditAction,
  cancelReservationAction,
  createReservationAction,
  registerPaymentAction,
  updateReservationAction,
} from "@/app/dashboard/reservas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type MemberLite = { user_id: string; full_name: string; email: string };

type ReservationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  reservation: Reservation | null;
  initialCourtId: string;
  initialTime: string;
  initialDate: string;
  courts: Court[];
  activeReservations: Reservation[];
  membership: Membership;
  onSaved: (reservation: Reservation) => void;
  onCancelled: (reservation: Reservation) => void;
};

const DEFAULT_SETTINGS = { cancel_window_hours: 24, late_penalty_percent: 50 };

export function ReservationDialog({
  open,
  onOpenChange,
  mode,
  reservation,
  initialCourtId,
  initialTime,
  initialDate,
  courts,
  activeReservations,
  membership,
  onSaved,
  onCancelled,
}: ReservationDialogProps) {
  const supabase = createClient();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [credit, setCredit] = useState<number | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [formError, setFormError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationInputSchema),
    defaultValues: {
      court_id: "",
      date: initialDate,
      time: "",
      customer_name: "",
      phone: "",
    },
  });

  const watchedCourtId = form.watch("court_id");
  const selectedCourt =
    courts.find((court) => court.id === watchedCourtId) ?? null;

  const slotPrice = selectedCourt
    ? getSlotPrice(selectedCourt, reservation?.duration_minutes ?? selectedCourt.slot_duration)
    : 0;
  const deposit = selectedCourt
    ? getDepositAmount(
        selectedCourt,
        reservation?.duration_minutes ?? selectedCourt.slot_duration
      )
    : 0;

  const isCancelled = reservation?.status === "cancelled";
  const depositPaid = payments
    .filter((p) => p.kind === "seña" && !p.released)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = payments
    .filter((p) => !p.released)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const loadExtras = useCallback(async () => {
    if (!reservation) return;
    setIsLoadingExtras(true);

    const [{ data: paymentsData }, { data: auditData }, { data: membersData }] =
      await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .eq("reservation_id", reservation.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("audit_log")
          .select("*")
          .eq("entity", "reservation")
          .eq("entity_id", reservation.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("memberships")
          .select("user_id, full_name, email")
          .eq("owner_id", membership.owner_id),
      ]);

    setPayments((paymentsData ?? []) as Payment[]);
    setAudit((auditData ?? []) as AuditEntry[]);
    setMembers((membersData ?? []) as MemberLite[]);

    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("owner_id", membership.owner_id)
      .maybeSingle();
    setSettings((settingsData as ClubSettings | null) ?? null);

    if (reservation.phone.trim()) {
      const { data: creditData } = await supabase
        .from("credit_balances")
        .select("amount")
        .eq("owner_id", membership.owner_id)
        .eq("customer_phone", reservation.phone.trim())
        .maybeSingle();
      setCredit(creditData ? Number(creditData.amount) : 0);
    } else {
      setCredit(null);
    }

    setIsLoadingExtras(false);
  }, [supabase, reservation, membership.owner_id]);

  // Reseteo y carga al abrir.
  useEffect(() => {
    if (!open) return;

    setFormError("");
    setCancelReason("");
    setCancelConfirmOpen(false);
    setPaymentMethod("efectivo");

    if (mode === "edit" && reservation) {
      form.reset({
        court_id: reservation.court_id,
        date: reservation.date,
        time: reservation.time,
        customer_name: reservation.customer_name,
        phone: reservation.phone,
      });
      loadExtras();
    } else {
      form.reset({
        court_id: initialCourtId,
        date: initialDate,
        time: initialTime,
        customer_name: "",
        phone: "",
      });
      setPayments([]);
      setCredit(null);
      setAudit([]);
      setSettings(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, reservation?.id]);

  const timeOptions = useMemo(() => {
    if (!selectedCourt) return [];
    const slots = getCourtSlots(selectedCourt);
    const current = form.getValues("time");
    if (current && !slots.includes(current)) {
      return [...slots, current].sort();
    }
    return slots;
  }, [selectedCourt, form]);

  // Si cambia la cancha y el horario deja de ser válido, se recoloca.
  const handleCourtChange = (courtId: string) => {
    form.setValue("court_id", courtId);
    const court = courts.find((c) => c.id === courtId);
    if (court) {
      const slots = getCourtSlots(court);
      const current = form.getValues("time");
      if (!slots.includes(current)) {
        form.setValue("time", "");
      }
    }
  };

  // ¿La cancelación sería tardía según la política del club?
  const cancelWindowHours = settings?.cancel_window_hours ?? DEFAULT_SETTINGS.cancel_window_hours;
  const latePenaltyPercent = settings?.late_penalty_percent ?? DEFAULT_SETTINGS.late_penalty_percent;
  const watchedDate = form.watch("date");
  const watchedTime = form.watch("time");
  const wouldBeLate = useMemo(() => {
    if (!watchedDate || !watchedTime) return false;
    // Mismo criterio que la Server Action: hora del club (Argentina, UTC-3).
    const startsAt = new Date(`${watchedDate}T${watchedTime}:00-03:00`);
    return (
      (startsAt.getTime() - Date.now()) / 3_600_000 < cancelWindowHours
    );
  }, [watchedDate, watchedTime, cancelWindowHours]);

  const profesorBlocked =
    membership.role === "profesor" && wouldBeLate && !isCancelled;

  const paidTotal = payments
    .filter((p) => !p.released)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const profesorMoneyBlocked =
    membership.role === "profesor" && !isCancelled && paidTotal > 0;

  const cancelConsequence = () => {
    const penalty = (slotPrice * latePenaltyPercent) / 100;

    if (!wouldBeLate) {
      return paidTotal > 0
        ? `Es una cancelación en término: los ${formatMoney(paidTotal)} cobrados se liberan como saldo a favor del cliente.`
        : "Es una cancelación en término: no se generan penalidades.";
    }

    const retained = Math.min(paidTotal, penalty);
    const released = paidTotal - retained;

    if (paidTotal > 0) {
      return `Es una cancelación tardía: se retiene ${formatMoney(retained)} como penalidad${
        released > 0
          ? ` y se liberan ${formatMoney(released)} como saldo a favor`
          : ""
      }.`;
    }

    return `Es una cancelación tardía: se va a registrar una deuda de ${formatMoney(penalty)} (${latePenaltyPercent}% del valor del turno).`;
  };

  const handleSubmit = async (values: ReservationInput) => {
    setFormError("");

    const court = courts.find((c) => c.id === values.court_id);
    if (!court) {
      setFormError("Seleccioná una cancha.");
      return;
    }

    const duration =
      mode === "edit" && reservation
        ? reservation.duration_minutes
        : court.slot_duration;

    const overlaps = activeReservations.some(
      (r) =>
        r.court_id === court.id &&
        r.date === values.date &&
        r.id !== reservation?.id &&
        rangesOverlap(
          timeToMinutes(values.time),
          duration,
          timeToMinutes(r.time),
          r.duration_minutes
        )
    );

    if (overlaps) {
      setFormError("Esa cancha ya está reservada en ese horario.");
      return;
    }

    setIsSubmitting(true);

    const result =
      mode === "edit" && reservation
        ? await updateReservationAction(reservation.id, values)
        : await createReservationAction(values);

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error ?? "No se pudo guardar la reserva.");
      return;
    }

    if (mode === "edit") {
      toast.success("Reserva actualizada");
      onSaved(result.reservation!);
      await loadExtras();
    } else {
      toast.success("Reserva creada");
      onSaved(result.reservation!);
      onOpenChange(false);
    }
  };

  const handleRegisterPayment = async (kind: "seña" | "total") => {
    if (!reservation) return;
    const { success, error, reservation: updated } =
      await registerPaymentAction(reservation.id, {
        kind,
        method: paymentMethod,
      });

    if (success) {
      toast.success(
        kind === "seña" ? "Seña registrada" : "Pago total registrado"
      );
      onSaved(updated!);
      await loadExtras();
    } else {
      toast.error(error ?? "No se pudo registrar el cobro");
    }
  };

  const handleApplyCredit = async () => {
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

  const handleCancel = async () => {
    if (!reservation) return;
    setIsSubmitting(true);
    const { success, error, reservation: updated } =
      await cancelReservationAction(reservation.id, cancelReason);
    setIsSubmitting(false);
    setCancelConfirmOpen(false);

    if (success) {
      toast.success("Reserva cancelada");
      onCancelled(updated!);
      onOpenChange(false);
    } else {
      toast.error(error ?? "No se pudo cancelar la reserva");
    }
  };

  const actorName = (actorId: string | null) => {
    if (!actorId) return "Sistema";
    const member = members.find((m) => m.user_id === actorId);
    return member?.full_name || member?.email || "Usuario";
  };

  const remaining = Math.max(0, slotPrice - totalPaid);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit" ? "Editar reserva" : "Nueva reserva"}
            </DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? "Modificá los datos, registrá cobros o cancelá la reserva."
                : "Completa los datos del turno."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="court_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cancha</FormLabel>
                      <Select
                        onValueChange={handleCourtChange}
                        value={field.value}
                        disabled={isCancelled}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Cancha" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {courts.map((court) => (
                            <SelectItem key={court.id} value={court.id}>
                              {court.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Controller
                  control={form.control}
                  name="time"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Horario</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isCancelled || !selectedCourt}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Horario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={isCancelled} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono / DNI</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="3415123456"
                          disabled={isCancelled}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del socio / equipo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Fernández / Casimiro"
                        disabled={isCancelled}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedCourt && mode === "create" && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                  <span>
                    Turno ({selectedCourt.slot_duration} min):{" "}
                    <strong>{formatMoney(slotPrice)}</strong>
                  </span>
                  <span>
                    Seña:{" "}
                    <strong>
                      {deposit > 0 ? formatMoney(deposit) : "No requiere"}
                    </strong>
                  </span>
                </div>
              )}

              {!isCancelled && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cerrar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Guardar reserva
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>

          {/* Sección de cobros y cancelación (solo edición) */}
          {mode === "edit" && reservation && (
            <div className="space-y-4 border-t pt-4">
              {isLoadingExtras ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      Valor del turno:{" "}
                      <strong>{formatMoney(slotPrice)}</strong>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span>
                      Cobrado: <strong>{formatMoney(totalPaid)}</strong>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <Badge
                      variant={
                        reservation.payment_status === "pagada"
                          ? "default"
                          : reservation.payment_status === "senada"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {PAYMENT_STATUS_LABELS[reservation.payment_status]}
                    </Badge>
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
                            {payment.released && (
                              <Badge variant="outline">Liberada</Badge>
                            )}
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
                            value={paymentMethod}
                            onValueChange={(value) =>
                              setPaymentMethod(value as PaymentMethod)
                            }
                          >
                            <SelectTrigger id="payment-method" className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(PAYMENT_METHOD_LABELS).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {deposit > 0 && depositPaid === 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleRegisterPayment("seña")}
                          >
                            Cobrar seña ({formatMoney(deposit)})
                          </Button>
                        )}
                        {reservation.payment_status !== "pagada" && (
                          <Button
                            type="button"
                            onClick={() => handleRegisterPayment("total")}
                          >
                            Cobrar total ({formatMoney(slotPrice)})
                          </Button>
                        )}
                      </div>

                      {credit !== null && credit > 0 && remaining > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleApplyCredit}
                        >
                          <Wallet className="mr-2 h-4 w-4" />
                          Aplicar saldo a favor ({formatMoney(credit)})
                        </Button>
                      )}

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="cancel-reason">
                          Motivo de cancelación (opcional)
                        </Label>
                        <Textarea
                          id="cancel-reason"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Ej. Lluvia, pedido del cliente..."
                          rows={2}
                        />

                        {profesorBlocked && (
                          <Alert>
                            <AlertDescription>
                              Este turno entra en la ventana de penalidad
                              (menos de {cancelWindowHours} hs de anticipación).
                              Como profesor no podés cancelarlo: consultá con un
                              administrador.
                            </AlertDescription>
                          </Alert>
                        )}

                        {profesorMoneyBlocked && (
                          <Alert>
                            <AlertDescription>
                              Esta reserva tiene cobros registrados. Como
                              profesor no podés cancelarla: la devolución o
                              retención de la plata la gestiona un
                              administrador u operador.
                            </AlertDescription>
                          </Alert>
                        )}

                        <Button
                          type="button"
                          variant="destructive"
                          disabled={profesorBlocked || profesorMoneyBlocked}
                          onClick={() => setCancelConfirmOpen(true)}
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
                        {reservation.cancel_reason &&
                          ` · Motivo: ${reservation.cancel_reason}`}
                      </AlertDescription>
                    </Alert>
                  )}

                  {membership.role === "admin" && audit.length > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <History className="h-4 w-4" />
                        Historial de acciones
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {audit.map((entry) => (
                          <li key={entry.id}>
                            <span className="font-medium text-foreground">
                              {actorName(entry.actor_id)}
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
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelConsequence()} ¿Confirmás la cancelación?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar cancelación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
