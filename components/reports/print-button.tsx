"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Abre el diálogo de impresión del navegador (desde ahí también se guarda como PDF). */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer />
      Imprimir / PDF
    </Button>
  );
}
