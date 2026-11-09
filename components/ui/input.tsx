import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, onFocus, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      // En los campos numéricos se selecciona el valor al entrar: lo que se escribe lo reemplaza
      // en lugar de quedar pegado al 0 ("05000").
      onFocus={(event) => {
        if (type === "number") event.currentTarget.select()
        onFocus?.(event)
      }}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-1 text-base transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[15px] dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // iOS (Safari y Chrome usan WebKit) dibuja la fecha y la hora nativas con un ancho mínimo
        // propio y más altas: se salían de la columna. Sin la apariencia nativa respetan el ancho;
        // el selector del sistema se sigue abriendo al tocar.
        (type === "date" || type === "time") &&
          "appearance-none [&::-webkit-date-and-time-value]:min-h-[1.5em] [&::-webkit-date-and-time-value]:text-left",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
