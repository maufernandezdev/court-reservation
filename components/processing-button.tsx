"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón que muestra que algo se está procesando (como el de Mercado Pago): cambia el texto,
 * una franja de luz lo cruza de izquierda a derecha y queda bloqueado hasta que termina.
 */
export function ProcessingButton({
  processing,
  processingLabel,
  children,
  className,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { processing: boolean; processingLabel: ReactNode }) {
  return (
    <Button
      {...props}
      disabled={disabled || processing}
      aria-busy={processing}
      className={cn("relative overflow-hidden", processing && "disabled:opacity-100", className)}
    >
      {processing && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="processing-sweep absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-current to-transparent opacity-25" />
        </span>
      )}
      <span className="relative inline-flex items-center gap-2">{processing ? processingLabel : children}</span>
    </Button>
  );
}
