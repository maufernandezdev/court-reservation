import { cn } from "@/lib/utils";

type CourtLinesProps = {
  /** "horizontal": cancha acostada con la pelota y su trayectoria (login). "vertical": solo líneas (registro). */
  variant?: "horizontal" | "vertical";
  className?: string;
};

/** Dibujo decorativo de una cancha vista desde arriba, para los paneles de marca. */
export function CourtLines({ variant = "horizontal", className }: CourtLinesProps) {
  if (variant === "vertical") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 360 780"
        fill="none"
        strokeWidth="2"
        className={cn("pointer-events-none stroke-sidebar-foreground/12", className)}
      >
        <rect x="1" y="1" width="358" height="778" />
        <path d="M45 1V779M315 1V779M45 180H315M45 600H315M180 180V600M-20 390H380" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 780 360"
      fill="none"
      strokeWidth="2"
      className={cn("pointer-events-none stroke-sidebar-foreground/16", className)}
    >
      <rect x="1" y="1" width="778" height="358" />
      <path d="M1 45H779M1 315H779M180 45V315M600 45V315M180 180H600M390 -20V380M1 180H12M768 180H779" />
      <path
        d="M520 250 C 470 150, 300 60, 140 120"
        className="stroke-ball"
        strokeDasharray="2 10"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="520" cy="250" r="11" className="fill-ball stroke-none" />
    </svg>
  );
}
