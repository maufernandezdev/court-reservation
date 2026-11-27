import Link from "next/link";
import { Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Fijo dado de baja solo por cancelaciones seguidas (datos planos que manda el servidor). */
export type SeriesAutoEnded = {
  id: string;
  customerName: string;
  cancellations: number;
  until: string | null;
  cancelled: number;
  kept: string[];
  at: string;
};

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/** Hoy (solo admin): aviso de los fijos que se dieron de baja solos en los últimos 7 días. */
export function SeriesAutoEndedNotice({ items }: { items: SeriesAutoEnded[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="fijos-de-baja"
      className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-dashed border-destructive/40 bg-card p-5"
    >
      <h2 id="fijos-de-baja" className="flex items-center gap-2 text-lg font-bold">
        <Repeat aria-hidden="true" className="size-5" />
        Fijos dados de baja por cancelaciones
        <Badge variant="outline">{items.length}</Badge>
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-0.5 rounded-xl border px-4 py-3">
            <strong className="text-[15px]">{item.customerName}</strong>
            <span className="text-[13px] text-pretty text-muted-foreground">
              {item.cancellations} cancelaciones seguidas
              {item.until ? ` · último turno ${shortDate(item.until)}` : ""}
              {item.cancelled ? ` · ${item.cancelled} ${item.cancelled === 1 ? "fecha liberada" : "fechas liberadas"}` : ""}
              {item.kept.length
                ? ` · quedan activas ${item.kept.map(shortDate).join(", ")} porque tienen cobros: cancelalas a mano`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <Button asChild variant="link" size="sm" className="self-start px-0">
        <Link href="/dashboard/actividad">Ver en Actividad</Link>
      </Button>
    </section>
  );
}
