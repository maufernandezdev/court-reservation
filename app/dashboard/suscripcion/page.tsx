"use client";

import { useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SUBSCRIPTION_PLANS } from "@/lib/mocks/data";
import { Check } from "lucide-react";

const formatPrice = (n: number) => `$${n.toLocaleString("es-AR")}`;

export default function SubscriptionPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Suscripción del Club</h1>
          <p className="text-muted-foreground">
            Elegí el plan que mejor se adapte a tu club.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border p-1">
            <Button
              variant={billing === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBilling("monthly")}
            >
              Mensual
            </Button>
            <Button
              variant={billing === "annual" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBilling("annual")}
            >
              Anual
              <Badge variant="secondary" className="ml-2">
                -10%
              </Badge>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const price =
              billing === "monthly" ? plan.monthlyPrice : plan.annualPrice;
            return (
              <Card
                key={plan.id}
                className={plan.active ? "border-primary ring-1 ring-primary" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.active && (
                      <Badge variant="default">Plan actual</Badge>
                    )}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{formatPrice(price)}</span>
                      <span className="text-muted-foreground">
                        /{billing === "monthly" ? "mes" : "año"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.courts}
                      {billing === "annual" && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="text-primary">
                            {formatPrice(Math.round(plan.annualPrice / 12))}/mes
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={plan.active ? "default" : "outline"}
                    className="w-full"
                  >
                    {plan.active ? "Gestionar plan" : "Elegir plan"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </AuthGuard>
  );
}
