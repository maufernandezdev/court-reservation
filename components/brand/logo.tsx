import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand";

type LogoMarkProps = {
  size?: number;
  className?: string;
};

/** Marca: cuadrado pelota con la "T" de la línea de saque (vista aérea de la cancha). */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect width="36" height="36" rx="9" className="fill-ball" />
      <path
        d="M8 14H28M18 14V28"
        className="stroke-ink"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  );
}

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: { mark: 28, text: "text-xl" },
  md: { mark: 36, text: "text-[26px]" },
  lg: { mark: 72, text: "text-6xl" },
} as const;

/** Marca + wordmark. Hereda el color de texto (claro sobre tinta, tinta sobre piso). */
export function Logo({ size = "md", className }: LogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark size={s.mark} />
      <span
        className={cn(
          "font-display font-extrabold leading-none tracking-tight font-stretch-[125%]",
          s.text
        )}
      >
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
