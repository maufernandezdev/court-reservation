"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Selector de día: escribe `?<param>=YYYY-MM-DD` en la URL (el Server Component vuelve a leer)
 * y conserva los demás parámetros (por ejemplo, el período de Reportes).
 */
export function CashDateNav({
  date,
  today,
  param = "fecha",
}: {
  date: string;
  today: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const go = (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === today) params.delete(param);
    else params.set(param, next);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        aria-label="Día anterior"
        onClick={() => go(shiftDay(date, -1))}
      >
        <ChevronLeft />
      </Button>
      <Label htmlFor={`date-${param}`} className="sr-only">
        Fecha
      </Label>
      <Input
        id={`date-${param}`}
        type="date"
        value={date}
        max={today}
        onChange={(event) => go(event.target.value)}
        className="w-auto font-mono"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Día siguiente"
        disabled={date >= today}
        onClick={() => go(shiftDay(date, 1))}
      >
        <ChevronRight />
      </Button>
      {date !== today && (
        <Button variant="ghost" onClick={() => go(today)}>
          Hoy
        </Button>
      )}
      {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
