import Link from "next/link";
import { MY_TURNS_VIEWS, MY_TURNS_VIEW_LABELS, type MyTurnsView } from "@/lib/my-turns";
import { Button } from "@/components/ui/button";

/** Vistas de Mis turnos: enlaces que escriben `?vista=` en la URL (la página vuelve a leer). */
export function ViewTabs({ current }: { current: MyTurnsView }) {
  return (
    <nav aria-label="Vista" className="flex flex-wrap gap-1.5">
      {MY_TURNS_VIEWS.map((view) => (
        <Button
          key={view}
          asChild
          size="sm"
          variant={view === current ? "default" : "outline"}
          aria-current={view === current ? "page" : undefined}
        >
          <Link href={view === "hoy" ? "/dashboard/mis-turnos" : `/dashboard/mis-turnos?vista=${view}`}>
            {MY_TURNS_VIEW_LABELS[view]}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
