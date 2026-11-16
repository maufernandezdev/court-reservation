"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { matchResultSchema, type MatchResultInput, type Reservation } from "@/lib/reservations";
import { matchSides } from "@/lib/reservation-tone";
import { setMatchResultAction } from "@/app/dashboard/reservas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

/** Resultado de un partido de torneo: quién ganó y el marcador (admin, operador u organizador). */
export function MatchResultForm({
  reservation,
  onSaved,
}: {
  reservation: Reservation;
  onSaved: (reservation: Reservation) => void;
}) {
  const sides = matchSides(reservation);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<MatchResultInput>({
    resolver: zodResolver(matchResultSchema),
    defaultValues: {
      result_winner: reservation.result_winner ?? null,
      result_score: reservation.result_score ?? "",
    },
  });

  const onSubmit = async (values: MatchResultInput) => {
    setIsSubmitting(true);
    const result = await setMatchResultAction(reservation.id, values);
    setIsSubmitting(false);
    if (!result.success || !result.reservation) {
      form.setError("result_score", { message: result.error ?? "No se pudo guardar el resultado." });
      return;
    }
    form.reset({
      result_winner: result.reservation.result_winner ?? null,
      result_score: result.reservation.result_score ?? "",
    });
    toast.success("Resultado guardado");
    onSaved(result.reservation);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-xl border p-3.5"
        noValidate
        aria-label="Resultado del partido"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <CircleCheck aria-hidden="true" className="size-4" />
          Resultado del partido
        </span>
        <Controller
          control={form.control}
          name="result_winner"
          render={({ field }) => (
            <FormItem>
              <FormLabel id={`winner-${reservation.id}`}>Ganó</FormLabel>
              <ToggleGroup
                type="single"
                variant="segmented"
                spacing={1}
                value={field.value ? String(field.value) : ""}
                onValueChange={(v) => field.onChange(v ? (Number(v) as 1 | 2) : null)}
                aria-labelledby={`winner-${reservation.id}`}
                className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
              >
                {sides.map((side, index) => (
                  <ToggleGroupItem key={index} value={String(index + 1)} className="h-auto min-h-9 w-full px-2 py-1.5 text-[13px] whitespace-normal">
                    {side}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="result_score"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marcador</FormLabel>
              <FormControl>
                <Input placeholder="6-4 3-6 10-8" className="font-mono" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" disabled={isSubmitting || !form.formState.isDirty}>
          {isSubmitting ? "Guardando…" : "Guardar resultado"}
        </Button>
      </form>
    </Form>
  );
}
