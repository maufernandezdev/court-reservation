"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Court } from "@/lib/courts";
import {
  MAX_PEOPLE,
  RESERVATION_KINDS,
  RESERVATION_KIND_LABELS,
  reservationInputSchema,
  sortedParticipants,
  type Reservation,
  type ReservationInput,
} from "@/lib/reservations";
import { getCourtSlots, rangesOverlap, timeToMinutes } from "@/lib/availability";
import { depositFor, formatMoney, quotePrice } from "@/lib/pricing";
import { useSportPrices } from "@/hooks/use-sport-prices";
import { useMembership } from "@/hooks/use-membership";
import { useProfes } from "@/hooks/use-profes";
import { useClubSettings } from "@/hooks/use-club-settings";
import {
  createReservationAction,
  updateReservationAction,
} from "@/app/dashboard/reservas/actions";
import { PeopleCombobox } from "@/components/reservations/people-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m}`;
}

const PEOPLE_LABELS: Record<ReservationInput["kind"], string> = {
  standard: "Quién reserva (y quiénes juegan)",
  profe: "Alumnos (opcional)",
  torneo: "Jugadores (2 para singles, 4 para dobles)",
};

/** Alta y edición de los datos del turno: tipo, cancha, horario, fecha, personas y teléfono. */
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
  const { membership } = useMembership();
  const isProfesor = membership.role === "profesor";
  const { profes } = useProfes();
  const { tournament_duration_minutes: tournamentDefault } = useClubSettings();
  const { prices } = useSportPrices();

  // El formulario se monta al abrir el diálogo: arranca ya con los valores.
  const valuesFor = (): ReservationInput => {
    if (mode === "edit" && reservation) {
      const people = sortedParticipants(reservation).map((p) => ({ name: p.name, socio_id: p.socio_id }));
      return {
        court_id: reservation.court_id,
        date: reservation.date,
        time: reservation.time,
        phone: reservation.phone,
        kind: reservation.kind,
        profe_user_id: reservation.profe_user_id,
        duration_minutes: reservation.duration_minutes,
        // En turnos de profe, la persona 1 es el profe: se editan solo los alumnos.
        people: reservation.kind === "profe" ? people.slice(1) : people,
      };
    }
    return {
      court_id: initialCourtId,
      date: initialDate,
      time: initialTime,
      phone: "",
      kind: isProfesor ? "profe" : "standard",
      profe_user_id: isProfesor ? membership.user_id : null,
      duration_minutes: tournamentDefault,
      people: [],
    };
  };

  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationInputSchema),
    defaultValues: valuesFor(),
  });

  const [courtId, kind, time, duration, people] = useWatch({
    control: form.control,
    name: ["court_id", "kind", "time", "duration_minutes", "people"],
  });
  const selectedCourt = courts.find((court) => court.id === courtId) ?? null;
  const effectiveDuration = selectedCourt
    ? kind === "torneo"
      ? Number(duration) || tournamentDefault
      : mode === "edit" && reservation && reservation.kind !== "torneo"
        ? reservation.duration_minutes
        : selectedCourt.slot_duration
    : 0;
  const slotPrice = selectedCourt
    ? quotePrice(prices[selectedCourt.type], kind, effectiveDuration)
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

  // La duración estándar de torneo llega después de montar: si todavía no se tocó, se aplica.
  useEffect(() => {
    if (mode === "create" && !form.getFieldState("duration_minutes").isDirty) {
      form.setValue("duration_minutes", tournamentDefault);
    }
  }, [tournamentDefault, mode, form]);

  const timeOptions = useMemo(() => {
    if (!selectedCourt) return [];
    const slots = getCourtSlots(selectedCourt);
    const current = form.getValues("time");
    if (current && !slots.includes(current)) {
      return [...slots, current].sort();
    }
    return slots;
  }, [selectedCourt, form]);

  // Duraciones de torneo posibles desde el horario elegido hasta el cierre de la cancha.
  const durationOptions = useMemo(() => {
    if (!selectedCourt || !time) return [];
    const available = timeToMinutes(selectedCourt.close_time) - timeToMinutes(time);
    const options: number[] = [];
    for (let m = 30; m <= Math.min(360, available); m += 30) options.push(m);
    return options;
  }, [selectedCourt, time]);

  // Si cambia la cancha y el horario deja de ser válido, se recoloca.
  const handleCourtChange = (nextCourtId: string) => {
    form.setValue("court_id", nextCourtId);
    const court = courts.find((c) => c.id === nextCourtId);
    if (court && !getCourtSlots(court).includes(form.getValues("time"))) {
      form.setValue("time", "");
    }
  };

  const handleKindChange = (next: ReservationInput["kind"]) => {
    form.setValue("kind", next, { shouldValidate: form.formState.isSubmitted });
    if (next === "torneo" && (mode === "create" || reservation?.kind !== "torneo")) {
      form.setValue("duration_minutes", tournamentDefault);
    }
    if (next !== "profe") form.setValue("profe_user_id", null);
  };

  const handlePeopleChange = (next: ReservationInput["people"]) => {
    form.setValue("people", next, { shouldValidate: form.formState.isSubmitted });
    // El teléfono del turno toma el de la ficha de quien reserva, si estaba vacío.
    const first = next[0];
    if (kind !== "profe" && first?.phone && !form.getValues("phone")) {
      form.setValue("phone", first.phone);
    }
  };

  const handleSubmit = async (values: ReservationInput) => {
    setFormError("");

    if (!selectedCourt) {
      setFormError("Seleccioná una cancha.");
      return;
    }

    const overlaps = activeReservations.some(
      (r) =>
        r.court_id === selectedCourt.id &&
        r.date === values.date &&
        r.id !== reservation?.id &&
        rangesOverlap(timeToMinutes(values.time), effectiveDuration, timeToMinutes(r.time), r.duration_minutes)
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

  const peopleError = form.formState.errors.people;
  const peopleErrorMessage = peopleError?.message ?? peopleError?.root?.message;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {!isProfesor && (
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel id="reservation-kind-label">Tipo de turno</FormLabel>
                <ToggleGroup
                  type="single"
                  variant="segmented"
                  spacing={1}
                  value={field.value}
                  onValueChange={(v) => v && handleKindChange(v as ReservationInput["kind"])}
                  aria-labelledby="reservation-kind-label"
                  disabled={isCancelled}
                  className="grid w-full grid-cols-3 rounded-lg bg-muted p-1"
                >
                  {RESERVATION_KINDS.map((k) => (
                    <ToggleGroupItem key={k} value={k} className="h-9 w-full">
                      {RESERVATION_KIND_LABELS[k]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormItem>
            )}
          />
        )}

        {kind === "profe" && !isProfesor && (
          <FormField
            control={form.control}
            name="profe_user_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profe</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                  disabled={isCancelled}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={profes.length ? "Elegí el profe" : "No hay profes en el equipo"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {profes.map((profe) => (
                      <SelectItem key={profe.user_id} value={profe.user_id}>
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: profe.color ?? "var(--muted-foreground)" }}
                        />
                        {profe.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
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
          {kind === "torneo" ? (
            <Controller
              control={form.control}
              name="duration_minutes"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Duración</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value)}
                    disabled={isCancelled || durationOptions.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Duración" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {durationOptions.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {durationLabel(m)}
                          {m === tournamentDefault ? " (estándar)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="3415123456" inputMode="tel" disabled={isCancelled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormItem>
          <FormLabel htmlFor="reservation-people">{PEOPLE_LABELS[kind]}</FormLabel>
          <PeopleCombobox
            id="reservation-people"
            value={people}
            onChange={handlePeopleChange}
            max={kind === "profe" ? MAX_PEOPLE - 1 : MAX_PEOPLE}
            disabled={isCancelled}
            invalid={!!peopleErrorMessage}
            firstLabel={kind === "profe" ? "Alumno" : kind === "torneo" ? "Jugador 1" : "Reserva"}
          />
          {peopleErrorMessage && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {peopleErrorMessage}
            </p>
          )}
        </FormItem>

        {kind === "torneo" && (
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="3415123456" inputMode="tel" disabled={isCancelled} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedCourt && !isCancelled && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-ink px-4 py-3 text-sm text-primary-foreground">
            <span className="text-sidebar-muted">
              {RESERVATION_KIND_LABELS[kind]} · {durationLabel(effectiveDuration)}
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
