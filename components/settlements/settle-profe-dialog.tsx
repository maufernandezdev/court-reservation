"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { settleAmountAction } from "@/app/dashboard/liquidaciones/actions";
import { PAYMENT_METHOD_LABELS, VISIBLE_PAYMENT_METHODS } from "@/lib/reservations";
import { formatMoney } from "@/lib/pricing";
import { ProcessingButton } from "@/components/processing-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

/** El monto se valida contra lo que debe el profe: se arma el schema con ese tope. */
function buildSchema(due: number) {
  return z
    .object({
      mode: z.enum(["total", "otro"]),
      amount: z.string(),
      method: z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" }),
    })
    .superRefine((values, ctx) => {
      if (values.mode !== "otro") return;
      const amount = Number(values.amount.replace(",", "."));
      if (!values.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Ingresá un monto mayor a cero" });
      } else if (amount > due) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: `No puede superar el saldo (${formatMoney(due)})` });
      }
    });
}
type SettleFormValues = z.infer<ReturnType<typeof buildSchema>>;

/** "Cobrar": el profe paga el total que debe u otro monto, que se descuenta de su cuenta. */
export function SettleProfeDialog({
  profeUserId,
  profeName,
  due,
  turns,
}: {
  profeUserId: string;
  profeName: string;
  /** Lo que debe hoy (turnos ya jugados sin pagar). */
  due: number;
  turns: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<SettleFormValues>({
    resolver: zodResolver(buildSchema(due)),
    defaultValues: { mode: "total", amount: "", method: "efectivo" },
  });
  const submitting = form.formState.isSubmitting;
  const mode = form.watch("mode");
  const typed = Number(form.watch("amount").replace(",", "."));
  const charge = mode === "total" ? due : Number.isFinite(typed) && typed > 0 ? typed : 0;
  const remaining = Math.max(0, Math.round((due - charge) * 100) / 100);

  const onSubmit = async (values: SettleFormValues) => {
    setError("");
    const amount = values.mode === "total" ? null : Math.round(Number(values.amount.replace(",", ".")) * 100) / 100;
    const result = await settleAmountAction({ profeUserId, amount, method: values.method });
    if (!result.success) {
      setError(result.error ?? "No se pudo registrar el cobro.");
      return;
    }
    toast.success(`Cobrado a ${profeName}: ${formatMoney(result.amount ?? 0)}`, {
      description: result.remaining
        ? `Le queda un saldo de ${formatMoney(result.remaining)}.`
        : "Su cuenta quedó en cero.",
    });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (next) {
          setError("");
          form.reset({ mode: "total", amount: "", method: "efectivo" });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <HandCoins />
          Cobrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar a {profeName}</DialogTitle>
          <DialogDescription>
            Saldo de {formatMoney(due)} por {turns} {turns === 1 ? "turno jugado" : "turnos jugados"}. Si paga una parte, se
            descuenta de su cuenta empezando por los turnos más viejos. Entra a la caja de hoy y se puede deshacer desde el
            historial.
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
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id="settle-mode-label">Cuánto paga</FormLabel>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    spacing={1}
                    value={field.value}
                    onValueChange={(v) => {
                      if (!v) return;
                      field.onChange(v);
                      if (v === "otro") setTimeout(() => form.setFocus("amount"), 0);
                    }}
                    disabled={submitting}
                    aria-labelledby="settle-mode-label"
                    className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                  >
                    <ToggleGroupItem value="total" className="h-9 w-full">
                      Total · {formatMoney(due)}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="otro" className="h-9 w-full">
                      Otro monto
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormItem>
              )}
            />
            {mode === "otro" && (
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={due}
                        step="any"
                        placeholder="0"
                        className="font-mono"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <dl className="flex flex-col gap-1 rounded-xl bg-muted px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt>Cobrás</dt>
                <dd className="font-mono font-bold">{formatMoney(charge)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Saldo que queda</dt>
                <dd className="font-mono">{formatMoney(remaining)}</dd>
              </div>
            </dl>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <ProcessingButton type="submit" processing={submitting} processingLabel="Procesando cobro…">
                Cobrar {formatMoney(charge)}
              </ProcessingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
