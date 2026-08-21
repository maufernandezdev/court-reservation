"use client";

import AuthGuard from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRODUCTS, TRANSACTIONS, COURTS, INITIAL_RESERVATIONS } from "@/lib/mocks/data";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { BarChart3, AlertTriangle, DollarSign, CalendarDays } from "lucide-react";

export default function ReportsPage() {
  const totalIncome = TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
  const totalReservations = INITIAL_RESERVATIONS.length;
  const occupancyRate = Math.round(
    (totalReservations / (COURTS.length * 14)) * 100
  );
  const lowStockProducts = PRODUCTS.filter(
    (p) => p.stock <= p.lowStockThreshold
  );

  const whatsappSummary =
    `*Resumen del día - Club Deportivo Central*\n` +
    `Ingresos: $${totalIncome.toLocaleString()}\n` +
    `Reservas: ${totalReservations}\n` +
    `Ocupación: ${occupancyRate}%\n` +
    `Alertas de stock: ${lowStockProducts.length}`;

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Resúmenes rápidos para compartir y alertas del club.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ingresos del día</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalIncome.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reservas hoy</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReservations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ocupación estimada</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyRate}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <WhatsAppIcon className="h-5 w-5 text-green-600" />
              <CardTitle>Resumen para WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                {whatsappSummary}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Alertas de stock</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length > 0 ? (
                <ul className="space-y-2">
                  {lowStockProducts.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <span className="font-medium">{product.name}</span>
                      <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                        {product.stock === 0 ? "Sin stock" : `${product.stock} unidades`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No hay alertas de stock.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
