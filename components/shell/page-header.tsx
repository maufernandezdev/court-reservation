import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  /** Línea chica arriba del título (ej. fecha y hora en Hoy). */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Botones/controles a la derecha; bajan debajo del título en pantallas angostas. */
  actions?: React.ReactNode;
  className?: string;
};

/** Encabezado común de las páginas del panel: título display + acciones. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && (
          <span className="font-mono text-sm text-muted-foreground uppercase">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-3xl leading-none font-extrabold tracking-[-0.03em] text-balance font-stretch-[125%] sm:text-[40px]">
          {title}
        </h1>
        {description && (
          <p className="text-base text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </header>
  );
}
