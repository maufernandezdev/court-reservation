"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Court } from "@/lib/courts";
import {
  reservationInputSchema,
  type Reservation,
  type ReservationInput,
} from "@/lib/reservations";
import { getCourtSlots, rangesOverlap, timeToMinutes } from "@/lib/availability";
import { depositFor, formatMoney, quotePrice } from "@/lib/pricing";
import { useSportPrices } from "@/hooks/use-sport-prices";
import {
  createReservationAction,
  updateReservationAction,
} from "@/app/dashboard/reservas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogFooter } from "@/components/ui/dialog";
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

export type ReservationFormProps = {
  /** Se resetea cada vez que pasa a `true` o cambia la reserva. */
  open: boolean;
  mode: "create" | "edit";
  reservation: Reservation | null;
  initialCourtId: string;
  initialTime: string;
  initialDate: string;
  courts: Court[];
  activeReservations: Reservation[];
  onSaved: (reservation: Reservation) => void;
  onClose: () => void;
};

/** Alta y edición de los datos del turno (cancha, horario, fecha, cliente). */
export function ReservationForm({
  open,
  mode,
  reservation,
  initialCourtId,
  initialTime,
  initialDate,
  courts,
  activeReservations,
  onSaved,
  onClose,
}: ReservationFormProps) {
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // El formulario se monta al abrir el diálogo: arranca ya con los valores.
  const valuesFor = (): ReservationInput =>
    mode === "edit" && reservation
      ? {
          court_id: reservation.court_id,
          date: reservation.date,
          time: reservation.time,
          customer_name: reservation.customer_name,
          phone: reservation.phone,
        }
      : {
          court_id: initialCourtId,
          date: initialDate,
          time: initialTime,
          customer_name: "",
          phone: "",
        };

  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationInputSchema),
    defaultValues: valuesFor(),
  });

  const watchedCourtId = form.watch("court_id");
  const selectedCourt =
    courts.find((court) => court.id === watchedCourtId) ?? null;
  const { prices } = useSportPrices();
  const slotPrice = selectedCourt
    ? quotePrice(
        prices[selectedCourt.type],
        reservation?.kind ?? "standard",
        reservation?.duration_minutes ?? selectedCourt.slot_duration
      )
    : 0;
  const deposit = selectedCourt ? depositFor(prices[selectedCourt.type], slotPrice) : 0;
  const isCancelled = reservation?.status === "cancelled";

  // Si el formulario queda montado y cambia la reserva o se reabre, se resetea.
  const resetKey = `${open}-${mode}-${reservation?.id ?? ""}-${initialCourtId}-${initialTime}-${initialDate}`;
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    setFormError("");
    if (open) form.reset(valuesFor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

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
    } else {
      toast.success("Reserva creada");
      onSaved(result.reservation!);
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                    <SelectTrigger className="w-full">
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
                    <SelectTrigger className="w-full">
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
                    inputMode="tel"
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-ink px-4 py-3 text-sm text-primary-foreground">
            <span className="text-sidebar-muted">
              Turno de {selectedCourt.slot_duration} min
            </span>
            <span className="font-mono">
              <strong>{formatMoney(slotPrice)}</strong> · seña{" "}
              <strong className="text-ball">
                {deposit > 0 ? formatMoney(deposit) : "no requiere"}
              </strong>
            </span>
          </div>
        )}

        {!isCancelled && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Guardar reserva
            </Button>
          </DialogFooter>
        )}
      </form>
    </Form>
  );
}
