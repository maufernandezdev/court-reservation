"use client";

import { useId } from "react";
import { PRICING_MODES, PRICING_MODE_LABELS, type PricingMode } from "@/lib/special-pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type PricingValues = {
  pricing_mode: PricingMode;
  unit_price: number | null;
  expected_people: number | null;
  custom_price: number | null;
};

export type PricingErrors = Partial<Record<keyof PricingValues, string>>;

/** Rótulo de ayuda de cada modo. */
export const PRICING_MODE_HINTS: Record<PricingMode, string> = {
  lista: "El valor sale de la lista de precios de la cancha.",
  sin_cargo: "Ocupa la cancha y no se cobra: no suma a la caja ni queda como deuda.",
  por_persona: "Cada fecha es una cuenta: cobrás a cada persona o todo junto al final, y la cerrás.",
  monto_fijo: "Un total a mano, que se cobra como cualquier turno.",
};

function toNumber(value: string): number | null {
  return value === "" ? null : Number(value);
}

/**
 * Cómo se cobra un turno o un fijo (solo admin): de lista, sin cargo, por persona (precio por
 * persona y cantidad habitual) o monto fijo. Controlado: la validación es del formulario que lo usa.
 */
export function PricingFields({
  value,
  onChange,
  errors = {},
  disabled = false,
}: {
  value: PricingValues;
  onChange: (next: PricingValues) => void;
  errors?: PricingErrors;
  disabled?: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<PricingValues>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label id={`${id}-mode`}>Precio</Label>
        <ToggleGroup
          type="single"
          variant="segmented"
          spacing={1}
          value={value.pricing_mode}
          disabled={disabled}
          onValueChange={(v) => {
            if (!v) return;
            const mode = v as PricingMode;
            set({
              pricing_mode: mode,
              unit_price: mode === "por_persona" ? value.unit_price : null,
              expected_people: mode === "por_persona" ? value.expected_people : null,
              custom_price: mode === "monto_fijo" ? value.custom_price : null,
            });
          }}
          aria-labelledby={`${id}-mode`}
          className="grid w-full grid-cols-2 rounded-lg bg-muted p-1 sm:grid-cols-4"
        >
          {PRICING_MODES.map((m) => (
            <ToggleGroupItem key={m} value={m} className="h-9 w-full">
              {PRICING_MODE_LABELS[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {value.pricing_mode === "por_persona" && (
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-unit`}>Precio por persona</Label>
            <Input
              id={`${id}-unit`}
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="10000"
              disabled={disabled}
              aria-invalid={!!errors.unit_price}
              value={value.unit_price ?? ""}
              onChange={(e) => set({ unit_price: toNumber(e.target.value) })}
            />
            {errors.unit_price && <p className="text-sm font-medium text-destructive">{errors.unit_price}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-people`}>Personas (habitual)</Label>
            <Input
              id={`${id}-people`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="4"
              disabled={disabled}
              aria-invalid={!!errors.expected_people}
              value={value.expected_people ?? ""}
              onChange={(e) => set({ expected_people: toNumber(e.target.value) })}
            />
            {errors.expected_people && (
              <p className="text-sm font-medium text-destructive">{errors.expected_people}</p>
            )}
          </div>
        </div>
      )}

      {value.pricing_mode === "monto_fijo" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-custom`}>Monto del turno</Label>
          <Input
            id={`${id}-custom`}
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            placeholder="15000"
            disabled={disabled}
            aria-invalid={!!errors.custom_price}
            value={value.custom_price ?? ""}
            onChange={(e) => set({ custom_price: toNumber(e.target.value) })}
          />
          {errors.custom_price && <p className="text-sm font-medium text-destructive">{errors.custom_price}</p>}
        </div>
      )}
    </div>
  );
}
