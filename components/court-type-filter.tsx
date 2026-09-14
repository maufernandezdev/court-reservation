"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COURT_TYPES,
  COURT_TYPE_LABELS,
  type CourtType,
} from "@/hooks/use-courts";

export type CourtTypeFilterValue = CourtType | "all";

export function CourtTypeFilter({
  value,
  onChange,
}: {
  value: CourtTypeFilterValue;
  onChange: (value: CourtTypeFilterValue) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CourtTypeFilterValue)}
    >
      <SelectTrigger className="w-auto" aria-label="Filtrar por tipo">
        <SelectValue placeholder="Todas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas</SelectItem>
        {COURT_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {COURT_TYPE_LABELS[type]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
