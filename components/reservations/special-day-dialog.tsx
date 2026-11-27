"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarOff } from "lucide-react";
import { applySpecialDayAction, removeSpecialDayAction } from "@/app/dashboard/reservas/special-day-actions";
import { ProcessingButton } from "@/components/processing-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Reservation } from "@/lib/reservations";
import {
  specialDaySchema,
  specialDaySummary,
  type SpecialDay,
  type SpecialDayInput,
} from "@/lib/special-days";

/**
 * Feriado o día especial: el admin elige si el club cierra, una tarifa por hora para todo el día y
 * si cancela los turnos que ya había (todos o solo los fijos). Al terminar avisa cuántos turnos se cancelaron.
 */
export function SpecialDayDialog({
  open,
  onOpenChange,
  date,
  dateLabel,
  specialDay,
  reservations,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  dateLabel: string;
  specialDay: SpecialDay | null;
  /** Turnos activos o por confirmar de ese día. */
  reservations: Reservation[];
  onApplied: () => void;
}) {
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);

  const defaults = (): SpecialDayInput => ({
    date,
    label: specialDay?.label ?? "Feriado",
    closed: specialDay?.closed ?? false,
    hourlyPrice: specialDay?.hourly_price != null ? String(specialDay.hourly_price) : "",
    cancel: "none",
  });
  const form = useForm<SpecialDayInput>({ resolver: zodResolver(specialDaySchema), defaultValues: defaults() });
  const submitting = form.formState.isSubmitting;
  const cancel = form.watch("cancel");

  const counts = useMemo(
    () => ({
      todos: reservations.length,
      fijos: reservations.filter((r) => r.series_id).length,
    }),
    [reservations]
  );

  // Cada vez que se abre (para cualquier fecha) arranca con los datos de ese día.
  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const close = (next: boolean) => {
    if (submitting || removing) return;
    onOpenChange(next);
  };

  const onSubmit = async (values: SpecialDayInput) => {
    setError("");
    // La fecha es siempre la del día que se está mirando.
    const res = await applySpecialDayAction({ ...values, date });
    if (!res.success) {
      setError(res.error ?? "No se pudo guardar el feriado.");
      return;
    }
    onApplied();
    const cancelled = (res.people ?? []).length;
    const details = [
      cancelled ? `Se cancelaron ${cancelled} turno(s); lo cobrado quedó como saldo a favor.` : "",
      res.repriced ? `${res.repriced} turno(s) tomaron la tarifa del día.` : "",
    ].filter(Boolean);
    toast.success(`${values.label} guardado`, { description: details.join(" ") || undefined });
    onOpenChange(false);
  };

  const remove = async () => {
    setRemoving(true);
    const res = await removeSpecialDayAction(date);
    setRemoving(false);
    if (!res.success) {
      setError(res.error ?? "No se pudo quitar el feriado.");
      return;
    }
    toast.success("Se quitó el día especial");
    onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feriado o día especial</DialogTitle>
          <DialogDescription>
            {`${dateLabel}. Podés cerrar el club, cobrar una tarifa especial y vaciar la planilla.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {specialDay && (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">Ahora: {specialDaySummary(specialDay)}</p>
              )}
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del día</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={submitting} placeholder="Feriado" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="closed"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5">
                    <div>
                      <FormLabel>El club cierra</FormLabel>
                      <FormDescription>Solo el admin puede cargar turnos ese día.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={submitting} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourlyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa del día por hora (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" disabled={submitting} placeholder="Ej.: 30000" />
                    </FormControl>
                    <FormDescription>
                      Vale para todos los turnos de precio de lista de ese día, también los de profe y torneo.
                      Los turnos que ya tienen cobros no cambian.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cancel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turnos que ya hay ese día</FormLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      disabled={submitting}
                      className="w-full"
                    >
                      <ToggleGroupItem value="none" className="flex-1">Dejarlos</ToggleGroupItem>
                      <ToggleGroupItem value="fijos" className="flex-1">Cancelar fijos ({counts.fijos})</ToggleGroupItem>
                      <ToggleGroupItem value="todos" className="flex-1">Cancelar todos ({counts.todos})</ToggleGroupItem>
                    </ToggleGroup>
                    <FormDescription>
                      {cancel === "none"
                        ? "No se cancela nada."
                        : "Se cancelan en término, sin penalidad: lo cobrado queda como saldo a favor. Los fijos siguen la semana siguiente. Esto no se puede deshacer."}
                    </FormDescription>
                  </FormItem>
                )}
              />
              <DialogFooter>
                {specialDay && (
                  <ProcessingButton
                    type="button"
                    variant="ghost"
                    processing={removing}
                    processingLabel="Quitando…"
                    disabled={submitting}
                    onClick={remove}
                    className="sm:mr-auto"
                  >
                    Quitar día especial
                  </ProcessingButton>
                )}
                <Button type="button" variant="outline" disabled={submitting || removing} onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <ProcessingButton type="submit" processing={submitting} processingLabel="Guardando…" disabled={removing}>
                  Guardar
                </ProcessingButton>
              </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Aviso del día especial arriba de la planilla. */
export function SpecialDayBanner({
  specialDay,
  canEdit,
  onEdit,
}: {
  specialDay: SpecialDay;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <span className="flex items-center gap-2">
        <CalendarOff className="size-4 shrink-0" aria-hidden="true" />
        {specialDaySummary(specialDay)}
      </span>
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          Editar
        </Button>
      )}
    </div>
  );
}
