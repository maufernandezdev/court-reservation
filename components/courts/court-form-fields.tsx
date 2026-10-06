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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** Campos del formulario de cancha (alta y edición), dentro de un <Form> de RHF. */
export function CourtFormFields({ form }: { form: UseFormReturn<CourtInput> }) {
  const depositEnabled = form.watch("deposit_enabled");
  const depositType = form.watch("deposit_type");

  return (
    <>
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
            <FormLabel>Tipo</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un tipo" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {COURT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {COURT_TYPE_LABELS[type]}
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

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="price_per_hour"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Precio por hora ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="10000"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Controller
          control={form.control}
          name="slot_duration"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Duración del turno</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number(value))}
                value={String(field.value ?? "")}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Duración" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SLOT_DURATIONS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutos
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
          name="open_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horario de apertura</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
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
              <FormLabel>Horario de cierre</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <FormField
          control={form.control}
          name="deposit_enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4">
              <div>
                <FormLabel className="text-sm font-medium leading-none">
                  Cobrar seña
                </FormLabel>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exigí una seña para confirmar las reservas de esta cancha.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {depositEnabled && (
          <div className="grid grid-cols-2 gap-4 border-t pt-3">
            <Controller
              control={form.control}
              name="deposit_type"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Tipo de seña</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEPOSIT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DEPOSIT_TYPE_LABELS[type]}
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
            <FormField
              control={form.control}
              name="deposit_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Valor ({depositType === "percent" ? "%" : "$"})
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max={depositType === "percent" ? "100" : undefined}
                      step={depositType === "percent" ? "1" : "100"}
                      placeholder={depositType === "percent" ? "30" : "5000"}
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
    </>
  );
}
