import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { CashDaySummary } from "@/lib/cash";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Resumen de la caja de hoy en Hoy (solo admin). Los números salen de `summarizeCashDay`,
 * el mismo cálculo que Caja y el cierre del día de Reportes.
 */
export function CashSummaryCard({ cash }: { cash: CashDaySummary }) {
  const rows = [
    { label: "Ingresos", value: cash.incomeTotal },
    { label: "Egresos", value: cash.expenseTotal },
    { label: "Mercado Pago", value: cash.income.mercado_pago },
  ];
  return (
    <Card aria-labelledby="caja-hoy">
      <CardHeader>
        <CardTitle id="caja-hoy" className="flex items-center gap-2 text-lg">
          <Wallet aria-hidden="true" className="size-5" />
          Caja de hoy
        </CardTitle>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/caja">
              Ver caja
              <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-0.5 rounded-xl bg-ball p-3.5 text-ball-foreground sm:col-span-1">
            <dt className="text-sm font-medium">Efectivo en caja</dt>
            <dd className="font-mono text-2xl font-bold">{formatMoney(cash.cashOnHand)}</dd>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border p-3.5",
                index === rows.length - 1 && "col-span-2 sm:col-span-1"
              )}
            >
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="font-mono text-xl font-bold">{formatMoney(row.value)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
