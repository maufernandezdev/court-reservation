"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { settleProfeAction } from "@/app/dashboard/liquidaciones/actions";
import { PAYMENT_METHOD_LABELS, VISIBLE_PAYMENT_METHODS } from "@/lib/reservations";
import { formatMoney } from "@/lib/pricing";
import { ProcessingButton } from "@/components/processing-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const settleFormSchema = z.object({
  method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
});
type SettleFormValues = z.infer<typeof settleFormSchema>;

/** "Cobrar liquidación": el profe paga de una vez el saldo de sus turnos del período. */
export function SettleProfeDialog({
  profeUserId,
  profeName,
  from,
  to,
  periodLabel,
  due,
  turns,
}: {
  profeUserId: string;
  profeName: string;
  from: string;
  to: string;
  periodLabel: string;
  due: number;
  turns: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<SettleFormValues>({ resolver: zodResolver(settleFormSchema), defaultValues: { method: "efectivo" } });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async ({ method }: SettleFormValues) => {
    setError("");
    const result = await settleProfeAction({ profeUserId, from, to, method });
    if (!result.success) {
      setError(result.error ?? "No se pudo registrar la liquidación.");
      return;
    }
    toast.success(`Liquidación cobrada: ${formatMoney(result.amount ?? 0)}`, {
      description: `${profeName} · ${result.count ?? 0} ${result.count === 1 ? "turno" : "turnos"} quedaron pagados.`,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setError("")}>
          <HandCoins />
          Cobrar {formatMoney(due)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar liquidación de {profeName}</DialogTitle>
          <DialogDescription>
            {periodLabel}: {turns} {turns === 1 ? "turno" : "turnos"} sin pagar. Entra a la caja de hoy y los turnos quedan pagados.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id="settle-method-label">Medio</FormLabel>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    spacing={1}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                    disabled={submitting}
                    aria-labelledby="settle-method-label"
                    className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                  >
                    {VISIBLE_PAYMENT_METHODS.map((method) => (
                      <ToggleGroupItem key={method} value={method} className="h-9 w-full">
                        {PAYMENT_METHOD_LABELS[method]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="flex justify-between rounded-xl bg-muted px-4 py-3 text-sm">
              <span>Total a cobrar</span>
              <strong className="font-mono">{formatMoney(due)}</strong>
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <ProcessingButton type="submit" processing={submitting} processingLabel="Procesando cobro…">
                Cobrar {formatMoney(due)}
              </ProcessingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
