"use client";

import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import {
  type CourtInput,
  COURT_TYPES,
  COURT_TYPE_LABELS,
  SLOT_DURATIONS,
  DEPOSIT_TYPES,
  DEPOSIT_TYPE_LABELS,
} from "@/lib/courts";
import { formatMoney, getDepositAmount, getSlotPrice } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** Resumen en vivo: valor de un turno y seña con la configuración actual del formulario. */
function PriceSummary({ form }: { form: UseFormReturn<CourtInput> }) {
  const [price, slot, depositEnabled, depositType, depositValue] = form.watch([
    "price_per_hour",
    "slot_duration",
    "deposit_enabled",
    "deposit_type",
    "deposit_value",
  ]);
  const pricePerHour = Number(price);
  const duration = Number(slot);
  if (!pricePerHour || pricePerHour <= 0 || !duration) return null;

  const court = {
    price_per_hour: pricePerHour,
    deposit_enabled: depositEnabled,
    deposit_type: depositType,
    deposit_value: Number(depositValue) || 0,
  };
  const slotPrice = getSlotPrice(court, duration);
  const deposit = getDepositAmount(court, duration);

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3.5 text-primary-foreground"
    >
      <span className="text-sm text-sidebar-muted">Un turno de {duration} min</span>
      <span className="font-mono text-[15px]">
        <strong>{formatMoney(slotPrice)}</strong> · seña{" "}
        <strong className="text-ball">
          {deposit > 0 ? formatMoney(deposit) : "no pide"}
        </strong>
      </span>
    </div>
  );
}

/** Campos del formulario de cancha (alta y edición), dentro de un <Form> de RHF. */
export function CourtFormFields({ form }: { form: UseFormReturn<CourtInput> }) {
  const depositEnabled = form.watch("deposit_enabled");
  const depositType = form.watch("deposit_type");

  return (
    <div className="flex flex-col gap-5">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl>
              <Input placeholder="Cancha 1" autoFocus {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Controller
        control={form.control}
        name="type"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel id="court-type-label">Deporte</FormLabel>
            <ToggleGroup
              type="single"
              variant="segmented"
              spacing={1}
              value={field.value ?? ""}
              onValueChange={(v) => v && field.onChange(v)}
              aria-labelledby="court-type-label"
              className="grid w-full grid-cols-3 rounded-lg bg-muted p-1"
            >
              {COURT_TYPES.map((type) => (
                <ToggleGroupItem key={type} value={type} className="h-9 w-full">
                  {COURT_TYPE_LABELS[type]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {fieldState.error && (
              <FormMessage>{fieldState.error.message}</FormMessage>
            )}
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="price_per_hour"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Precio por hora</FormLabel>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-muted-foreground"
              >
                $
              </span>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  placeholder="24000"
                  className="pl-7 font-mono"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <Controller
        control={form.control}
        name="slot_duration"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel id="slot-duration-label">Duración del turno</FormLabel>
            <ToggleGroup
              type="single"
              variant="segmented"
              spacing={1}
              value={field.value ? String(field.value) : ""}
              onValueChange={(v) => v && field.onChange(Number(v))}
              aria-labelledby="slot-duration-label"
              className="grid w-full grid-cols-3 rounded-lg bg-muted p-1"
            >
              {SLOT_DURATIONS.map((minutes) => (
                <ToggleGroupItem key={minutes} value={String(minutes)} className="h-9 w-full">
                  {minutes} min
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {fieldState.error && (
              <FormMessage>{fieldState.error.message}</FormMessage>
            )}
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="open_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Abre</FormLabel>
              <FormControl>
                <Input type="time" className="font-mono" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="close_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cierra</FormLabel>
              <FormControl>
                <Input type="time" className="font-mono" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <FormField
          control={form.control}
          name="deposit_enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <FormLabel className="text-[15px] font-semibold">
                  Pedir seña al reservar
                </FormLabel>
                <p className="text-[13px] text-muted-foreground">
                  Sin seña, el turno queda pendiente hasta que se cobre.
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {depositEnabled && (
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <Controller
              control={form.control}
              name="deposit_type"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel id="deposit-type-label">Tipo</FormLabel>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    spacing={1}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                    aria-labelledby="deposit-type-label"
                    className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                  >
                    {DEPOSIT_TYPES.map((type) => (
                      <ToggleGroupItem key={type} value={type} className="h-9 w-full px-1 text-[13px]">
                        {type === "percent" ? "%" : "$ fijo"}
                        <span className="sr-only">{DEPOSIT_TYPE_LABELS[type]}</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {fieldState.error && (
                    <FormMessage>{fieldState.error.message}</FormMessage>
                  )}
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
                      placeholder={depositType === "percent" ? "30" : "5000"}
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

      <PriceSummary form={form} />
    </div>
  );
}
