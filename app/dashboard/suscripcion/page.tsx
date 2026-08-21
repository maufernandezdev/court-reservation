"use client";

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

export default function SubscriptionPage() {
  return (
    <AuthGuard>
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Suscripción del Club</h1>
          <p className="text-muted-foreground">
            Elegí el plan que mejor se adapte a tu club.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
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
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
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
                  disabled={plan.id === "free"}
                >
                  {plan.active ? "Gestionar plan" : plan.id === "free" ? "Comenzar prueba" : "Elegir plan"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
