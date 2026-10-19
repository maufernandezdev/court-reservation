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
import {
  DEFAULT_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  maxDurationAt,
  minutesToTime,
  rangesOverlap,
  startTimes,
  timeToMinutes,
} from "@/lib/availability";
import { digitsOnly } from "@/lib/players";
import { depositFor, formatMoney, isNight, quotePrice } from "@/lib/pricing";
import { useSportPrices } from "@/hooks/use-sport-prices";
import { createClient } from "@/lib/supabase/client";
import { ensureFixedReservations } from "@/lib/series";
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
import { Checkbox } from "@/components/ui/checkbox";
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

/** "sábados" para una fecha YYYY-MM-DD. */
function weekdayName(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const name = new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long" });
  return name.endsWith("s") ? name : `${name}s`;
}

/** "2/11" para una fecha YYYY-MM-DD. */
function shortDateKey(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${d}/${m}`;
}

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
  // Si quien reserva ya eligió el fin a mano; si no, el fin se calcula solo (1 hora o lo que entre).
  const [endTouched, setEndTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { membership } = useMembership();
  const isProfesor = membership.role === "profesor";
  const { profes } = useProfes();
  const {
    tournament_duration_minutes: tournamentDefault,
    night_starts_at: nightStartsAt,
    open_time,
    close_time,
    loaded: settingsLoaded,
  } = useClubSettings();
  const hours = useMemo(() => ({ open_time, close_time }), [open_time, close_time]);
  const { prices } = useSportPrices();

  // El formulario se monta al abrir el diálogo: arranca ya con los valores.
  const valuesFor = (): ReservationInput => {
    if (mode === "edit" && reservation) {
      const people = sortedParticipants(reservation).map((p) => ({ name: p.name, player_id: p.player_id }));
      return {
        court_id: reservation.court_id,
        date: reservation.date,
        time: reservation.time,
        phone: digitsOnly(reservation.phone),
        kind: reservation.kind,
        profe_user_id: reservation.profe_user_id,
        duration_minutes: reservation.duration_minutes,
        // En turnos de profe, la persona 1 es el profe: se editan solo los alumnos.
        people: reservation.kind === "profe" ? people.slice(1) : people,
        // Un turno que ya es fijo se muestra tildado.
        repeat_weekly: !!reservation.series_id,
      };
    }
    return {
      court_id: initialCourtId,
      date: initialDate,
      time: initialTime,
      phone: "",
      kind: isProfesor ? "profe" : "standard",
      profe_user_id: isProfesor ? membership.user_id : null,
      duration_minutes: DEFAULT_DURATION_MINUTES,
      people: [],
      repeat_weekly: false,
    };
  };

  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationInputSchema),
    defaultValues: valuesFor(),
  });

  const [courtId, kind, time, duration, people, date] = useWatch({
    control: form.control,
    name: ["court_id", "kind", "time", "duration_minutes", "people", "date"],
  });
  const selectedCourt = courts.find((court) => court.id === courtId) ?? null;
  const isCancelled = reservation?.status === "cancelled";
  /** Turno de un fijo semanal: la opción de repetir va tildada y no se cambia desde acá. */
  const isFixed = mode === "edit" && !!reservation?.series_id;

  // Si el formulario queda montado y cambia la reserva o se reabre, se resetea.
  const resetKey = `${open}-${mode}-${reservation?.id ?? ""}-${initialCourtId}-${initialTime}-${initialDate}`;
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    setFormError("");
    setEndTouched(false);
    if (open) form.reset(valuesFor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Horarios de inicio: cada 30 min dentro del horario del club (más el actual si quedó fuera).
  const timeOptions = useMemo(() => {
    const times = startTimes(hours);
    const current = form.getValues("time");
    return current && !times.includes(current) ? [...times, current].sort() : times;
  }, [hours, form]);

  // Turnos del día elegido: los que ya tiene la planilla, o los de otra fecha si se cambió en el formulario.
  const supabase = useMemo(() => createClient(), []);
  const [otherDay, setOtherDay] = useState<{ date: string; list: Reservation[] } | null>(null);
  useEffect(() => {
    if (!open || !date || date === initialDate) {
      setOtherDay(null);
      return;
    }
    let cancelled = false;
    ensureFixedReservations(supabase, membership.club_id, date)
      .then(() =>
        supabase
          .from("reservations")
          .select("*")
          .eq("club_id", membership.club_id)
          .eq("date", date)
          .eq("status", "active")
      )
      .then(({ data }) => {
        if (!cancelled) setOtherDay({ date, list: (data ?? []) as Reservation[] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, date, initialDate, supabase, membership.club_id]);

  const dayReservations = useMemo(
    () =>
      date === initialDate
        ? activeReservations.filter((r) => r.date === date)
        : otherDay?.date === date
          ? otherDay.list
          : [],
    [activeReservations, date, initialDate, otherDay]
  );

  // Turnos de una cancha en el día elegido, sin el que se edita: limitan cuánto puede durar el nuevo.
  const reservationsOfCourt = (id: string) =>
    dayReservations.filter((r) => r.court_id === id && r.id !== reservation?.id);

  // Las canchas se habilitan según el horario: solo aparecen las que tienen lugar (al menos 30 min) desde ahí.
  const courtsFreeAt = (at: string): Court[] => {
    if (!at || !settingsLoaded) return courts;
    const originalSlot = mode === "edit" && reservation && reservation.time === at && reservation.date === date;
    return courts.filter(
      (c) =>
        maxDurationAt(hours, reservationsOfCourt(c.id), at) >= MIN_DURATION_MINUTES ||
        (originalSlot && c.id === reservation.court_id)
    );
  };
  const availableCourts = courtsFreeAt(time);

  // Si al cambiar la fecha o las reservas la cancha elegida ya no tiene lugar a ese horario, pasa a la primera libre.
  const availableKey = availableCourts.map((c) => c.id).join(",");
  useEffect(() => {
    if (isCancelled || !settingsLoaded || !time || availableCourts.length === 0) return;
    if (!availableCourts.some((c) => c.id === courtId)) {
      form.setValue("court_id", availableCourts[0].id, { shouldValidate: form.formState.isSubmitted });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey, time, courtId]);

  const courtReservations = useMemo(
    () => dayReservations.filter((r) => r.court_id === courtId && r.id !== reservation?.id),
    [dayReservations, courtId, reservation?.id]
  );

  // Duraciones posibles desde el horario elegido: de 30 min hasta el siguiente turno, el cierre o 6 h.
  const maxDuration = time ? maxDurationAt(hours, courtReservations, time) : 0;
  const durationOptions = useMemo(() => {
    const options: number[] = [];
    for (let m = MIN_DURATION_MINUTES; m <= maxDuration; m += MIN_DURATION_MINUTES) options.push(m);
    // En una edición, la duración actual sigue siendo una opción aunque hoy no entre.
    const current = Number(duration);
    if (mode === "edit" && current && !options.includes(current)) options.push(current);
    return options.sort((a, b) => a - b);
  }, [maxDuration, duration, mode]);

  // La duración se calcula sin depender de efectos: 1 hora por defecto (un torneo, la de Políticas), o la que
  // eligió quien reserva; siempre acotada a lo que entra hasta el siguiente turno o el cierre.
  const defaultDuration = kind === "torneo" ? tournamentDefault : DEFAULT_DURATION_MINUTES;
  const atOriginalSlot =
    mode === "edit" &&
    !!reservation &&
    reservation.time === time &&
    reservation.court_id === courtId &&
    reservation.date === date;
  const wantedDuration = mode === "create" && !endTouched ? defaultDuration : Number(duration) || defaultDuration;
  const effectiveDuration = selectedCourt
    ? settingsLoaded && maxDuration > 0 && wantedDuration > maxDuration && !atOriginalSlot
      ? maxDuration
      : wantedDuration
    : 0;
  // El precio de día o de noche se elige por la hora de inicio del turno.
  const slotPrice = selectedCourt
    ? quotePrice(prices[selectedCourt.type], kind, effectiveDuration, time, nightStartsAt)
    : 0;
  const startsAtNight = !!time && isNight(time, nightStartsAt);
  const deposit = selectedCourt ? depositFor(prices[selectedCourt.type], kind, slotPrice) : 0;

  // Al cambiar el inicio, el fin vuelve a completarse solo (1 hora, o lo que entre) y, si la cancha elegida no
  // tiene lugar a ese horario, pasa a la primera que sí. En una edición se conserva la duración.
  const handleTimeChange = (next: string) => {
    form.setValue("time", next, { shouldValidate: form.formState.isSubmitted });
    setEndTouched(false);
    const free = courtsFreeAt(next);
    const target = free.find((c) => c.id === courtId) ?? free[0];
    if (target && target.id !== courtId) form.setValue("court_id", target.id);
  };

  const handleCourtChange = (nextCourtId: string) => {
    form.setValue("court_id", nextCourtId);
  };

  const handleKindChange = (next: ReservationInput["kind"]) => {
    form.setValue("kind", next, { shouldValidate: form.formState.isSubmitted });
    setEndTouched(false);
    if (next !== "profe") form.setValue("profe_user_id", null);
    if (next === "torneo") form.setValue("repeat_weekly", false);
  };

  const handlePeopleChange = (next: ReservationInput["people"]) => {
    form.setValue("people", next, { shouldValidate: form.formState.isSubmitted });
    // El teléfono del turno toma el de la ficha de quien reserva, si estaba vacío.
    const first = next[0];
    if (kind !== "profe" && first?.phone && !form.getValues("phone")) {
      form.setValue("phone", digitsOnly(first.phone));
    }
  };

  const handleSubmit = async (values: ReservationInput) => {
    setFormError("");

    if (!selectedCourt) {
      setFormError("Seleccioná una cancha.");
      return;
    }

    const overlaps = dayReservations.some(
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
    const payload = { ...values, duration_minutes: effectiveDuration };
    const result =
      mode === "edit" && reservation
        ? await updateReservationAction(reservation.id, payload)
        : await createReservationAction(payload);
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error ?? "No se pudo guardar la reserva.");
      return;
    }

    if (mode === "edit" && (isFixed || !values.repeat_weekly)) {
      toast.success("Reserva actualizada");
      onSaved(result.reservation!);
    } else if (values.repeat_weekly) {
      const skipped = result.skippedDates ?? [];
      toast.success("Turno fijo creado", {
        description: skipped.length
          ? `Se saltearon ${skipped.map(shortDateKey).join(", ")} porque la cancha ya estaba ocupada.`
          : `Queda reservado todos los ${weekdayName(values.date)} a las ${values.time}.`,
        duration: skipped.length ? 10000 : 4000,
      });
      if (result.reservation) onSaved(result.reservation);
      onClose();
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
                  disabled={isCancelled || availableCourts.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={time && availableCourts.length === 0 ? "Sin canchas libres" : "Cancha"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableCourts.map((court) => (
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Controller
            control={form.control}
            name="time"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Desde</FormLabel>
                <Select
                  onValueChange={handleTimeChange}
                  value={field.value}
                  disabled={isCancelled || !selectedCourt}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Inicio" />
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
          <Controller
            control={form.control}
            name="duration_minutes"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Hasta</FormLabel>
                <Select
                  key={`${courtId}-${time}-${durationOptions.join(",")}-${effectiveDuration}`}
                  onValueChange={(v) => {
                    setEndTouched(true);
                    field.onChange(Number(v));
                  }}
                  value={settingsLoaded && durationOptions.length ? String(effectiveDuration) : ""}
                  disabled={isCancelled || !settingsLoaded || durationOptions.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={!settingsLoaded ? "…" : time && maxDuration === 0 ? "Horario ocupado" : "Fin"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {durationOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {minutesToTime(timeToMinutes(time) + m)} · {durationLabel(m)}
                        {kind === "torneo" && m === tournamentDefault ? " (estándar)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>

        {kind !== "torneo" && (
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input
                    placeholder="1155551111"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    disabled={isCancelled}
                    {...field}
                    onChange={(event) => field.onChange(digitsOnly(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
                  <Input
                    placeholder="1155551111"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    disabled={isCancelled}
                    {...field}
                    onChange={(event) => field.onChange(digitsOnly(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Al editar, un turno suelto puede pasar a repetirse; uno que ya es fijo va tildado y se da de baja desde el detalle. */}
        {(mode === "create" || (reservation && !isCancelled)) && kind !== "torneo" && (
          <FormField
            control={form.control}
            name="repeat_weekly"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 rounded-xl border p-3.5">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={isFixed}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="flex flex-col gap-0.5">
                  <FormLabel className="text-[15px] font-semibold">Repetir todas las semanas</FormLabel>
                  <p className="text-[13px] text-pretty text-muted-foreground">
                    {isFixed
                      ? `Este turno ya es fijo: se repite todos los ${date ? weekdayName(date) : "días"}. Para darlo de baja, usá "Dar de baja el fijo" en el detalle del turno. Los cambios de acá valen solo para esta fecha.`
                      : `Turno fijo: se reserva todos los ${date ? weekdayName(date) : "días"}${time ? ` a las ${time}` : ""} hasta darlo de baja. Cada fecha se cobra aparte.`}
                  </p>
                </div>
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
              <strong>{formatMoney(slotPrice)}</strong>
              {startsAtNight && " (noche)"} · seña{" "}
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
