import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonVariant = "list" | "kpis" | "cards" | "form" | "schedule";

/**
 * Esqueleto de carga de las páginas del panel (lo usan los `loading.tsx`). Cada sección
 * tiene el suyo y no hay uno en `app/dashboard`: al navegar entre secciones solo se
 * re-renderiza lo que está debajo del layout compartido, y Next precarga cada ruta hasta
 * su primer `loading.tsx` (uno a nivel del panel tapaba los de cada sección).
 */
export function PageSkeleton({ variant = "list" }: { variant?: PageSkeletonVariant }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Cargando">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-56 sm:h-10" />
      </div>

      {variant === "schedule" && (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-12 shrink-0 rounded-xl" />
          ))}
        </div>
      )}

      {(variant === "kpis" || variant === "cards") && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton
              key={i}
              className={variant === "cards" ? "h-44 rounded-2xl" : "h-28 rounded-2xl"}
            />
          ))}
        </div>
      )}

      {variant === "form" ? (
        <div className="flex max-w-2xl flex-col gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : variant !== "cards" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: variant === "kpis" ? 3 : 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
