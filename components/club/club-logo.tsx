import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo del club o, si no hay, sus iniciales. El logo va dentro de un recuadro de `size` de alto y
 * `width` de ancho (por defecto cuadrado) y se ajusta entero, sin deformarse: uno horizontal llena
 * un recuadro apaisado. Lo sirve `/api/clubs/[clubId]/logo` (exige sesión de un miembro), por eso va
 * `unoptimized`: el navegador lo pide con sus cookies. Es chico y está arriba de todo, así que carga
 * sin demora (`loading="eager"`).
 */
export function ClubLogo({
  src,
  initials,
  name,
  size = 36,
  width,
  className,
}: {
  src: string | null;
  initials: string;
  name: string;
  /** Alto del recuadro (y lado de las iniciales). */
  size?: number;
  /** Ancho del recuadro del logo; por defecto igual al alto. */
  width?: number;
  className?: string;
}) {
  if (src) {
    const boxWidth = width ?? size;
    return (
      <span
        className={cn("relative block shrink-0 overflow-hidden rounded-lg bg-white", className)}
        style={{ width: boxWidth, height: size }}
      >
        <Image
          src={src}
          alt={`Logo de ${name}`}
          fill
          sizes={`${boxWidth}px`}
          unoptimized
          loading="eager"
          className="object-contain"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-sidebar-foreground font-display font-extrabold text-sidebar font-stretch-[125%]",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.31)) }}
    >
      {initials}
    </span>
  );
}
