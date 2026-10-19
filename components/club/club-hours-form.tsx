"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { minutesToTime } from "@/lib/availability";
import { clubHoursSchema, type ClubHoursInput } from "@/lib/clubs";
import { updateClubHoursAction } from "@/app/dashboard/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

/** Horarios posibles de apertura y cierre: cada 30 minutos, de 00:00 a 23:30. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => minutesToTime(i * 30));

/**
 * Horario de apertura y cierre del club: vale para todas las canchas. Se usa en Políticas y en el
 * modal de bienvenida (con `onSaved` y `secondary` para encadenar los pasos).
 */
export function ClubHoursForm({
  openTime,
  closeTime,
  submitLabel = "Guardar horario",
  secondary,
  onSaved,
}: {
  openTime: string;
  closeTime: string;
  submitLabel?: string;
  /** Botones al lado del de guardar (p. ej. "Atrás" en la bienvenida). */
  secondary?: React.ReactNode;
  onSaved?: (values: ClubHoursInput) => void;
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClubHoursInput>({
    resolver: zodResolver(clubHoursSchema),
    defaultValues: { open_time: openTime, close_time: closeTime },
  });

  const onSubmit = async (values: ClubHoursInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await updateClubHoursAction(values);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "No se pudo guardar el horario del club.");
      return;
    }

    form.reset(values);
    toast.success(`Horario del club: de ${values.open_time} a ${values.close_time}`);
    onSaved?.(values);
  };

  const timeField = (name: "open_time" | "close_time", label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger className="w-full font-mono">
                <SelectValue placeholder="Elegí el horario" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time} className="font-mono">
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {timeField("open_time", "Abre a las")}
          {timeField("close_time", "Cierra a las")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondary}
          <Button type="submit" disabled={isSubmitting || (!onSaved && !form.formState.isDirty)}>
            {isSubmitting ? "Guardando…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Tarjeta "Horario del club" de Políticas. */
export function ClubHoursCard({ openTime, closeTime }: { openTime: string; closeTime: string }) {
  return (
    <section aria-labelledby="horario-del-club" className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id="horario-del-club" className="text-lg font-bold">
          Horario del club
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          Desde qué hora hasta qué hora se puede reservar. Es el mismo para todas las canchas y marca el rango de
          la planilla. Los turnos ya cargados no se modifican.
        </p>
      </div>
      <ClubHoursForm key={`${openTime}-${closeTime}`} openTime={openTime} closeTime={closeTime} />
    </section>
  );
}
