"use client";

import { useState } from "react";
import AuthGuard from "@/components/auth-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCTS } from "@/lib/mocks/data";
import { ScanBarcode } from "lucide-react";

export default function ProductsPage() {
  const [barcode, setBarcode] = useState("");

  return (
    <AuthGuard>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos / Kiosco</h1>
          <p className="text-muted-foreground">
            Stock de productos y simulador de lectura de código de barras.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Escaneá o escribí el código de barras..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => setBarcode("")}>
            Limpiar
          </Button>
        </div>

        {barcode && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            Simulación: código leído <strong>{barcode}</strong>. En una versión futura se buscará el producto automáticamente.
          </div>
        )}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRODUCTS.map((product) => {
                const isLow = product.stock <= product.lowStockThreshold;
                const isOut = product.stock === 0;
                return (
                  <TableRow key={product.id} className={isOut ? "bg-destructive/10" : undefined}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right">{product.stock}</TableCell>
                    <TableCell className="text-right">${product.price.toLocaleString()}</TableCell>
                    <TableCell>
                      {isOut ? (
                        <Badge variant="destructive">Sin stock</Badge>
                      ) : isLow ? (
                        <Badge variant="secondary">Stock bajo</Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AuthGuard>
  );
}
