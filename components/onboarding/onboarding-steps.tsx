import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Tu cuenta", "Tu club", "Tus canchas"];

/** Pasos del alta en el panel de marca (artboard AltaClub). `current` empieza en 1. */
export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-col gap-7" aria-label="Pasos del alta">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            className="flex items-center gap-4"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full font-mono font-semibold",
                done && "bg-sidebar-foreground/12",
                active && "bg-ball text-ball-foreground",
                !done && !active && "border-[1.5px] border-sidebar-foreground/40 text-sidebar-muted"
              )}
            >
              {done ? <Check className="size-[18px] text-ball" strokeWidth={2.6} /> : step}
            </span>
            <strong className={cn("text-lg", !active && "text-sidebar-muted")}>
              {label}
              {done && <span className="sr-only"> (listo)</span>}
            </strong>
          </li>
        );
      })}
    </ol>
  );
}
