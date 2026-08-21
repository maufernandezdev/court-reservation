"use client";

import { useMemo, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TRANSACTIONS } from "@/lib/mocks/data";
import { DollarSign, TrendingUp, Receipt } from "lucide-react";

export default function CashPage() {
  const [date, setDate] = useState("2026-08-20");

  const total = useMemo(
    () => TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0),
    []
  );

  const reservationTotal = useMemo(
    () =>
      TRANSACTIONS.filter((t) => t.concept.toLowerCase().includes("reserva"))
        .reduce((sum, t) => sum + t.amount, 0),
    []
  );

  const kioskTotal = useMemo(
    () =>
      TRANSACTIONS.filter(
        (t) =>
          t.concept.toLowerCase().includes("kiosco") ||
          t.concept.toLowerCase().includes("alquiler")
      ).reduce((sum, t) => sum + t.amount, 0),
    []
  );

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
            <p className="text-muted-foreground">Resumen diario de ingresos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total del día</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${total.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reservas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${reservationTotal.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Kiosco / Alquileres</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${kioskTotal.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TRANSACTIONS.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.concept}</TableCell>
                    <TableCell>{transaction.time}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${transaction.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
