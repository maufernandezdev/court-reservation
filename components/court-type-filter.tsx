"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COURT_TYPES,
  COURT_TYPE_LABELS,
  type CourtType,
} from "@/lib/courts";
import { cn } from "@/lib/utils";

export type CourtTypeFilterValue = CourtType | "all";

/** Filtro por deporte como control segmentado (Todas · Tenis · Pádel…). */
export function CourtTypeFilter({
  value,
  onChange,
  available,
  className,
}: {
  value: CourtTypeFilterValue;
  onChange: (value: CourtTypeFilterValue) => void;
  /** Deportes que tiene el club; si se omite, se muestran todos. */
  available?: CourtType[];
  className?: string;
}) {
  const types = COURT_TYPES.filter((t) => !available || available.includes(t));

  // Con un solo deporte el filtro no aporta nada.
  if (available && types.length < 2) return null;

  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      spacing={1}
      value={value}
      onValueChange={(v) => v && onChange(v as CourtTypeFilterValue)}
      aria-label="Filtrar por deporte"
      className={cn("rounded-lg bg-muted p-1", className)}
    >
      <ToggleGroupItem value="all" className="h-9 px-3.5">
        Todas
      </ToggleGroupItem>
      {types.map((type) => (
        <ToggleGroupItem key={type} value={type} className="h-9 px-3.5">
          {COURT_TYPE_LABELS[type]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
