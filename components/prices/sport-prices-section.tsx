"use client";

import { useState } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  COURT_TYPE_LABELS,
  DEPOSIT_TYPES,
  DEPOSIT_TYPE_LABELS,
  type CourtType,
} from "@/lib/courts";
import { DEFAULT_DURATION_MINUTES, minutesToTime } from "@/lib/availability";
import {
  depositFor,
  formatMoney,
  nightStartSchema,
  quotePriceFor,
  sportPricesSchema,
  type NightStartInput,
  type SportPrices,
  type SportPricesInput,
} from "@/lib/pricing";
import { updateNightStartAction, updateSportPricesAction } from "@/app/dashboard/canchas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

/** Importe en pesos: el 0 se muestra como campo vacío (con el 0 de guía), así se escribe directo. */
function MoneyInput({ value, ...props }: React.ComponentProps<typeof Input>) {
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
        placeholder="0"
        className="pl-7 font-mono"
        {...props}
        value={Number(value) === 0 ? "" : value}
      />
    </div>
  );
}

function toValues(sport: CourtType, row: SportPrices | undefined): SportPricesInput {
  return {
    sport,
    public_price_per_hour: Number(row?.public_price_per_hour ?? 0),
    profe_price_per_hour: Number(row?.profe_price_per_hour ?? 0),
    public_night_price_per_hour: Number(row?.public_night_price_per_hour ?? 0),
    profe_night_price_per_hour: Number(row?.profe_night_price_per_hour ?? 0),
    public_deposit_enabled: row?.public_deposit_enabled ?? false,
    public_deposit_type: row?.public_deposit_type ?? "percent",
    public_deposit_value: Number(row?.public_deposit_value ?? 0),
    profe_deposit_enabled: row?.profe_deposit_enabled ?? false,
    profe_deposit_type: row?.profe_deposit_type ?? "percent",
    profe_deposit_value: Number(row?.profe_deposit_value ?? 0),
  };
}

type Audience = "public" | "profe";

/** Seña de una audiencia (público o profes): interruptor y, si se pide, tipo y valor. */
function DepositFields({
  form,
  sport,
  audience,
  title,
  hint,
}: {
  form: UseFormReturn<SportPricesInput>;
  sport: CourtType;
  audience: Audience;
  title: string;
  hint: string;
}) {
  const enabled = useWatch({ control: form.control, name: `${audience}_deposit_enabled` });
  const type = useWatch({ control: form.control, name: `${audience}_deposit_type` });
  const typeLabelId = `deposit-type-${audience}-${sport}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3.5">
      <FormField
        control={form.control}
        name={`${audience}_deposit_enabled`}
        render={({ field }) => (
          <FormItem className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <FormLabel className="text-[15px] font-semibold">{title}</FormLabel>
              <span className="text-[13px] font-normal text-muted-foreground">{hint}</span>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      {enabled && (
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <Controller
            control={form.control}
            name={`${audience}_deposit_type`}
            render={({ field }) => (
              <FormItem>
                <FormLabel id={typeLabelId}>Tipo</FormLabel>
                <ToggleGroup
                  type="single"
                  variant="segmented"
                  spacing={1}
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                  aria-labelledby={typeLabelId}
                  className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                >
                  {DEPOSIT_TYPES.map((option) => (
                    <ToggleGroupItem key={option} value={option} className="h-9 w-full px-1 text-[13px]">
                      {option === "percent" ? "%" : "$ fijo"}
                      <span className="sr-only">{DEPOSIT_TYPE_LABELS[option]}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${audience}_deposit_value`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor ({type === "percent" ? "%" : "$"})</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={type === "percent" ? "100" : undefined}
                    step={type === "percent" ? "1" : "100"}
                    placeholder="0"
                    className="font-mono"
                    {...field}
                    value={Number(field.value) === 0 ? "" : (field.value ?? "")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

/** Precios de un tipo de cancha: público y profe de día y de noche, y las señas, con el valor de un turno de ejemplo. */
function SportPricesCard({
  sport,
  row,
  nightStartsAt,
}: {
  sport: CourtType;
  row: SportPrices | undefined;
  nightStartsAt: string;
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
    public_night_price_per_hour: Number(values.public_night_price_per_hour) || 0,
    profe_night_price_per_hour: Number(values.profe_night_price_per_hour) || 0,
    public_deposit_value: Number(values.public_deposit_value) || 0,
    profe_deposit_value: Number(values.profe_deposit_value) || 0,
  } as SportPrices;
  // El resumen muestra el valor de un turno de 1 hora (la duración se elige en cada turno).
  const publicDay = quotePriceFor(preview, "standard", DEFAULT_DURATION_MINUTES, false);
  const profeDay = quotePriceFor(preview, "profe", DEFAULT_DURATION_MINUTES, false);
  const publicNight = quotePriceFor(preview, "standard", DEFAULT_DURATION_MINUTES, true);
  const profeNight = quotePriceFor(preview, "profe", DEFAULT_DURATION_MINUTES, true);
  const publicDeposit = depositFor(preview, "standard", publicDay);
  const publicDepositNight = depositFor(preview, "standard", publicNight);
  const profeDeposit = depositFor(preview, "profe", profeDay);
  const profeDepositNight = depositFor(preview, "profe", profeNight);

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
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-muted-foreground">
              De día · hasta las {nightStartsAt}
            </legend>
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
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-muted-foreground">
              De noche · desde las {nightStartsAt}
            </legend>
            <p className="-mt-1 text-[13px] text-muted-foreground">
              Si lo dejás vacío, se cobra el precio de día.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="public_night_price_per_hour"
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
                name="profe_night_price_per_hour"
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
          </fieldset>

          <DepositFields
            form={form}
            sport={sport}
            audience="public"
            title="Seña del público"
            hint="Turnos estándar y de torneo."
          />
          <DepositFields
            form={form}
            sport={sport}
            audience="profe"
            title="Seña de profes"
            hint="Turnos de profe."
          />

          <p
            aria-live="polite"
            className="flex flex-col gap-1 rounded-xl bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-primary-foreground"
          >
            <span>
              Turno de 1 hora de día: <strong>{formatMoney(publicDay)}</strong> público ·{" "}
              <strong>{formatMoney(profeDay)}</strong> profe
            </span>
            <span>
              De noche: <strong>{formatMoney(publicNight)}</strong> público ·{" "}
              <strong>{formatMoney(profeNight)}</strong> profe
            </span>
            <span>
              Seña del público:{" "}
              <strong className="text-ball">{publicDeposit > 0 ? formatMoney(publicDeposit) : "no pide"}</strong>
              {publicDeposit > 0 && publicDepositNight !== publicDeposit && (
                <>
                  {" "}
                  de día · <strong className="text-ball">{formatMoney(publicDepositNight)}</strong> de noche
                </>
              )}
            </span>
            <span>
              Seña de profes:{" "}
              <strong className="text-ball">{profeDeposit > 0 ? formatMoney(profeDeposit) : "no pide"}</strong>
              {profeDeposit > 0 && profeDepositNight !== profeDeposit && (
                <>
                  {" "}
                  de día · <strong className="text-ball">{formatMoney(profeDepositNight)}</strong> de noche
                </>
              )}
            </span>
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

const NIGHT_START_OPTIONS = Array.from({ length: 24 }, (_, i) => minutesToTime(12 * 60 + i * 30));

/** Hora desde la que rige el precio de noche, igual para todo el club. */
function NightStartCard({ nightStartsAt }: { nightStartsAt: string }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<NightStartInput>({
    resolver: zodResolver(nightStartSchema),
    defaultValues: { night_starts_at: nightStartsAt },
  });

  const onSubmit = async (input: NightStartInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await updateNightStartAction(input);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar el horario de noche.");
      return;
    }
    form.reset(input);
    toast.success(`La noche empieza a las ${input.night_starts_at}`);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-end"
        noValidate
      >
        <FormField
          control={form.control}
          name="night_starts_at"
          render={({ field }) => (
            <FormItem className="sm:w-48">
              <FormLabel>La noche empieza a las</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full font-mono">
                    <SelectValue placeholder="Elegí el horario" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {NIGHT_START_OPTIONS.map((time) => (
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
        <p className="text-[14px] text-pretty text-muted-foreground sm:flex-1">
          Se cobra según la hora de inicio del turno: si empieza antes se cobra todo a precio de día, y si
          empieza a esa hora o después, todo a precio de noche. Es igual para todas las canchas.
        </p>
        <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
          {isSubmitting ? "Guardando…" : "Guardar horario"}
        </Button>
        {error && (
          <Alert variant="destructive" className="sm:basis-full">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </form>
    </Form>
  );
}

/** Contenido del modal Precios: el horario de la noche y una tarjeta por tipo de cancha que tiene el club. */
export function SportPricesSection({
  sports,
  rows,
  nightStartsAt,
}: {
  sports: CourtType[];
  rows: SportPrices[];
  nightStartsAt: string;
}) {
  if (sports.length === 0) return null;

  return (
    <section aria-label="Precios" className="flex flex-col gap-3">
      <NightStartCard key={nightStartsAt} nightStartsAt={nightStartsAt} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3.5">
        {sports.map((sport) => (
          <SportPricesCard
            key={sport}
            sport={sport}
            row={rows.find((r) => r.sport === sport)}
            nightStartsAt={nightStartsAt}
          />
        ))}
      </div>
    </section>
  );
}
