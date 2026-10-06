import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CourtLines } from "@/components/brand/court-lines";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

const SPORTS = ["Tenis", "Pádel", "Fútbol", "Clubes"];

type AuthLayoutProps = {
  children: React.ReactNode;
  /** Contenido alternativo del panel de marca (ej. pasos del registro). */
  aside?: React.ReactNode;
  courtVariant?: "horizontal" | "vertical";
};

/**
 * Pantallas de acceso: panel de marca oscuro + formulario.
 * En celular el panel se reduce a una franja con el logo para que el
 * formulario quede visible sin desplazarse (ver specs/auth-screens).
 */
export function AuthLayout({
  children,
  aside,
  courtVariant = "horizontal",
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <section className="relative flex shrink-0 flex-col justify-between gap-12 overflow-hidden bg-sidebar px-6 py-5 text-sidebar-foreground lg:min-h-screen lg:flex-[1_1_560px] lg:px-14 lg:py-12">
        <CourtLines
          variant={courtVariant}
          className={
            courtVariant === "horizontal"
              ? "absolute -right-36 -bottom-10 hidden w-[900px] -rotate-[8deg] lg:block"
              : "absolute top-[18%] left-[40%] hidden w-[520px] lg:block"
          }
        />

        <Link
          href="/login"
          className="relative w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ball"
        >
          <Logo />
        </Link>

        <div className="relative hidden lg:block">
          {aside ?? (
            <div className="flex max-w-[520px] flex-col gap-5">
              <p className="font-display text-[56px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance font-stretch-[125%]">
                {PRODUCT_TAGLINE}
              </p>
              <p className="text-lg leading-relaxed text-pretty text-sidebar-muted">
                Reservas, cobros y equipo de tu club en una sola planilla. Desde
                la recepción o desde el celular.
              </p>
              <ul className="flex flex-wrap gap-2" aria-label="Deportes">
                {SPORTS.map((sport) => (
                  <li
                    key={sport}
                    className="rounded-full border border-sidebar-foreground/28 px-3.5 py-1.5 text-sm"
                  >
                    {sport}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="relative hidden font-mono text-[13px] text-sidebar-label lg:block">
          © {new Date().getFullYear()} {PRODUCT_NAME}
        </p>
      </section>

      <section className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 lg:flex-[1_1_440px] lg:py-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </div>
  );
}

/** Título + bajada de los formularios de acceso. */
export function AuthHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <span className="font-mono text-[13px] text-muted-foreground">
          {eyebrow}
        </span>
      )}
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] font-stretch-[112%] sm:text-[32px]">
        {title}
      </h1>
      {description && (
        <p className="text-base text-pretty text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
