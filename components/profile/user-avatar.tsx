import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Foto de una persona o sus iniciales. La foto la sirve `/api/avatars/[userId]`
 * (exige sesión), por eso va `unoptimized`: el navegador la pide con sus cookies.
 */
export function UserAvatar({
  src,
  initials,
  name,
  size = 36,
  className,
  style,
}: {
  src: string | null;
  initials: string;
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={`Foto de ${name}`}
        width={size}
        height={size}
        unoptimized
        // Es chica y está arriba de todo (menú, perfil): carga sin demora, como pide Next.js para la imagen más grande.
        loading="eager"
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size, ...style }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-line font-bold text-line-foreground",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...style }}
    >
      {initials}
    </span>
  );
}
