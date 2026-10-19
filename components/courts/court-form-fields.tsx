"use client";

import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import {
  type CourtInput,
  COURT_TYPES,
  COURT_TYPE_LABELS,
} from "@/lib/courts";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** Campos del formulario de cancha (alta y edición), dentro de un <Form> de RHF. */
export function CourtFormFields({ form }: { form: UseFormReturn<CourtInput> }) {
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

      <p className="rounded-xl bg-muted px-4 py-3 text-[13px] text-pretty text-muted-foreground">
        El precio (público y profe) y la seña son los mismos para todas las canchas del
        mismo deporte: se configuran en <strong className="text-foreground">Precios</strong>.
        El horario es el del club (Políticas) y la duración se elige en cada turno.
      </p>
    </div>
  );
}
