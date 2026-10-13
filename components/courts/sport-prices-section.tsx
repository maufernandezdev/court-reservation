"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  COURT_TYPE_LABELS,
  DEPOSIT_TYPES,
  DEPOSIT_TYPE_LABELS,
  type CourtType,
} from "@/lib/courts";
import {
  depositFor,
  formatMoney,
  quotePrice,
  sportPricesSchema,
  type SportPrices,
  type SportPricesInput,
} from "@/lib/pricing";
import { updateSportPricesAction } from "@/app/dashboard/canchas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

function MoneyInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-muted-foreground"
      >
        $
      </span>
      <Input
        type="number"
        inputMode="numeric"
        min="0"
        step="100"
        className="pl-7 font-mono"
        {...props}
      />
    </div>
  );
}

function toValues(sport: CourtType, row: SportPrices | undefined): SportPricesInput {
  return {
    sport,
    public_price_per_hour: Number(row?.public_price_per_hour ?? 0),
    profe_price_per_hour: Number(row?.profe_price_per_hour ?? 0),
    deposit_enabled: row?.deposit_enabled ?? false,
    deposit_type: row?.deposit_type ?? "percent",
    deposit_value: Number(row?.deposit_value ?? 0),
  };
}

/** Precios de un tipo de cancha: público, profe y seña, con el valor de un turno de ejemplo. */
function SportPricesCard({
  sport,
  row,
  slotDuration,
}: {
  sport: CourtType;
  row: SportPrices | undefined;
  slotDuration: number;
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<SportPricesInput>({
    resolver: zodResolver(sportPricesSchema),
    defaultValues: toValues(sport, row),
  });

  const values = useWatch({ control: form.control });
  const preview = {
    ...toValues(sport, row),
    ...values,
    public_price_per_hour: Number(values.public_price_per_hour) || 0,
    profe_price_per_hour: Number(values.profe_price_per_hour) || 0,
    deposit_value: Number(values.deposit_value) || 0,
  } as SportPrices;
  const publicSlot = quotePrice(preview, "standard", slotDuration);
  const profeSlot = quotePrice(preview, "profe", slotDuration);
  const deposit = depositFor(preview, publicSlot);

  const onSubmit = async (input: SportPricesInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await updateSportPricesAction(input);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudieron guardar los precios.");
      return;
    }
    form.reset(input);
    toast.success(`Precios de ${COURT_TYPE_LABELS[sport].toLowerCase()} guardados`);
  };

  const depositEnabled = values.deposit_enabled;
  const depositType = values.deposit_type;

  return (
    <section
      aria-labelledby={`precios-${sport}`}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
    >
      <h3
        id={`precios-${sport}`}
        className="font-display text-xl font-extrabold tracking-[-0.02em] font-stretch-[115%]"
      >
        {COURT_TYPE_LABELS[sport]}
      </h3>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="public_price_per_hour"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Público por hora</FormLabel>
                  <FormControl>
                    <MoneyInput {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="profe_price_per_hour"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profe por hora</FormLabel>
                  <FormControl>
                    <MoneyInput {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border p-3.5">
            <FormField
              control={form.control}
              name="deposit_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="text-[15px] font-semibold">Pedir seña</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {depositEnabled && (
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <Controller
                  control={form.control}
                  name="deposit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel id={`deposit-type-${sport}`}>Tipo</FormLabel>
                      <ToggleGroup
                        type="single"
                        variant="segmented"
                        spacing={1}
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                        aria-labelledby={`deposit-type-${sport}`}
                        className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                      >
                        {DEPOSIT_TYPES.map((type) => (
                          <ToggleGroupItem key={type} value={type} className="h-9 w-full px-1 text-[13px]">
                            {type === "percent" ? "%" : "$ fijo"}
                            <span className="sr-only">{DEPOSIT_TYPE_LABELS[type]}</span>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deposit_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor ({depositType === "percent" ? "%" : "$"})</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={depositType === "percent" ? "100" : undefined}
                          step={depositType === "percent" ? "1" : "100"}
                          className="font-mono"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <p
            aria-live="polite"
            className="rounded-xl bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-primary-foreground"
          >
            Turno de {slotDuration} min: <strong>{formatMoney(publicSlot)}</strong> público ·{" "}
            <strong>{formatMoney(profeSlot)}</strong> profe · seña{" "}
            <strong className="text-ball">{deposit > 0 ? formatMoney(deposit) : "no pide"}</strong>
          </p>

          <div>
            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting ? "Guardando…" : "Guardar precios"}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}

/** "Precios" en Canchas: una tarjeta por tipo de cancha que tiene el club. */
export function SportPricesSection({
  sports,
  rows,
}: {
  sports: { sport: CourtType; slotDuration: number }[];
  rows: SportPrices[];
}) {
  if (sports.length === 0) return null;

  return (
    <section aria-labelledby="precios" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="precios" className="text-lg font-bold">
          Precios
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          Valen para todas las canchas del mismo deporte. Los turnos ya reservados mantienen el valor
          con el que se reservaron.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3.5">
        {sports.map(({ sport, slotDuration }) => (
          <SportPricesCard
            key={sport}
            sport={sport}
            row={rows.find((r) => r.sport === sport)}
            slotDuration={slotDuration}
          />
        ))}
      </div>
    </section>
  );
}
