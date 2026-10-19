"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/pricing";
import { PLAN_DESCRIPTIONS, courtsLimitText, courtsRangeText, type BillingCycle, type Plan } from "@/lib/subscription";

/** Planes con alternador mensual/anual. El pago online llega con Mercado Pago: por ahora el botón no hace nada. */
export function PlansSection({
  plans,
  currentPlanCode,
  initialCycle,
}: {
  plans: Plan[];
  currentPlanCode: string | null;
  initialCycle: BillingCycle;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);

  return (
    <section aria-label="Planes" className="space-y-4">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Ciclo de pago">
          <Button
            variant={cycle === "monthly" ? "default" : "ghost"}
            size="sm"
            aria-pressed={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
          >
            Mensual
          </Button>
          <Button
            variant={cycle === "yearly" ? "default" : "ghost"}
            size="sm"
            aria-pressed={cycle === "yearly"}
            onClick={() => setCycle("yearly")}
          >
            Anual
            <Badge variant="secondary" className="ml-2">
              -10%
            </Badge>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.code === currentPlanCode;
          const price = cycle === "monthly" ? plan.monthly_price : plan.yearly_price;
          return (
            <Card key={plan.code} className={current ? "border-primary ring-1 ring-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {current && <Badge>Plan actual</Badge>}
                </div>
                <CardDescription>{PLAN_DESCRIPTIONS[plan.code] ?? ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatMoney(price)}</span>
                    <span className="text-muted-foreground">/{cycle === "monthly" ? "mes" : "año"}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {courtsRangeText(plans, plan)}
                    {cycle === "yearly" && " · un solo pago al año, con 10 % de descuento"}
                  </p>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {courtsLimitText(plan.max_courts)}, de cualquier tipo
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant={current ? "default" : "outline"} className="w-full" disabled>
                  Próximamente
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
