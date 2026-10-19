import Link from "next/link";
import { REPORT_PERIODS, REPORT_PERIOD_LABELS, type ReportPeriod } from "@/lib/reports";
import { Button } from "@/components/ui/button";

/** Selector de período de Reportes: enlaces que escriben `?periodo=` en la URL (la página vuelve a leer). */
export function PeriodTabs({ current }: { current: ReportPeriod }) {
  return (
    <nav aria-label="Período" className="flex flex-wrap gap-1.5">
      {REPORT_PERIODS.map((period) => (
        <Button
          key={period}
          asChild
          size="sm"
          variant={period === current ? "default" : "outline"}
          aria-current={period === current ? "page" : undefined}
        >
          <Link href={period === "hoy" ? "/dashboard/reportes" : `/dashboard/reportes?periodo=${period}`}>
            {REPORT_PERIOD_LABELS[period]}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
