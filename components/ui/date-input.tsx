"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { es } from "react-day-picker/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "AAAA-MM-DD" → Date local (sin corrimientos de zona horaria). */
function keyToDate(key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Date local → "AAAA-MM-DD". */
function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA", como se escribe en Argentina. */
export function formatDateKeyAR(key: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

type DateInputProps = {
  /** Fecha en formato "AAAA-MM-DD" (el mismo valor que usaba el input nativo). */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  /** Disparador propio (por ejemplo, la fecha escrita de la planilla). Si no se pasa, un botón con DD/MM/AAAA. */
  children?: React.ReactNode;
};

/**
 * Selector de fecha en día/mes/año. Reemplaza al `<input type="date">`, que el navegador muestra
 * con su propio idioma (mes/día/año si está en inglés).
 */
export function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  id,
  className,
  placeholder = "DD/MM/AAAA",
  children,
  ...rest
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const selected = keyToDate(value);
  const minDate = min ? keyToDate(min) : undefined;
  const maxDate = max ? keyToDate(max) : undefined;
  const hidden = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children ?? (
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={rest["aria-label"]}
            className={cn("justify-between gap-2 font-mono font-normal", !value && "text-muted-foreground", className)}
          >
            {value ? formatDateKeyAR(value) : placeholder}
            <CalendarDays className="size-4 text-muted-foreground" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected}
          disabled={hidden}
          onSelect={(date) => {
            if (!date) return;
            onChange(dateToKey(date));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
