"use client";

import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";

/** Elige hasta qué fecha liquidar (nunca después de hoy). */
export function SettleUntilPicker({ value, min, max }: { value: string; min?: string; max: string }) {
  const router = useRouter();
  return (
    <DateInput
      value={value}
      min={min}
      max={max}
      aria-label="Liquidar hasta"
      onChange={(next) => {
        if (!next || next > max) return;
        router.push(next === max ? "/dashboard/liquidaciones" : `/dashboard/liquidaciones?hasta=${next}`);
      }}
    />
  );
}
