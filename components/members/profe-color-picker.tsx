"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { FALLBACK_PROFE_COLOR, PROFE_COLORS } from "@/lib/profe-colors";
import { updateProfeColorAction } from "@/app/dashboard/equipo/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Color del profe en la planilla (Equipo, solo admin). */
export function ProfeColorPicker({
  membershipId,
  name,
  color,
  onChanged,
}: {
  membershipId: string;
  name: string;
  color: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = color ?? FALLBACK_PROFE_COLOR;

  const choose = async (value: string) => {
    setOpen(false);
    if (value === color) return;
    const result = await updateProfeColorAction(membershipId, value);
    if (result.success) {
      toast.success(`Color de ${name} actualizado`);
      onChanged();
    } else {
      toast.error(result.error ?? "No se pudo cambiar el color");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Color de ${name} en la planilla`}
          className="flex size-9 items-center justify-center rounded-lg border hover:bg-muted focus-visible:outline-2 focus-visible:outline-line"
        >
          <span className="size-5 rounded-full" style={{ backgroundColor: current }} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <p className="mb-2 text-sm font-semibold">Color en la planilla</p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={`Color de ${name}`}>
          {PROFE_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === current}
              aria-label={option.label}
              title={option.label}
              onClick={() => choose(option.value)}
              className="flex size-9 items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line"
              style={{ backgroundColor: option.value }}
            >
              {option.value === current && <Check className="size-4" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
