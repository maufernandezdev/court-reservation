"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Ban, Check, Pencil } from "lucide-react";
import { cashOpeningSchema, type CashOpeningInput } from "@/lib/cash";
import { formatMoney } from "@/lib/pricing";
import { setCashOpeningAction, voidCashMovementAction } from "@/app/dashboard/caja/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Cambio inicial del día: lo ve todo el personal y lo edita el admin. */
export function CashOpeningForm({ date, amount, canEdit }: { date: string; amount: number; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<CashOpeningInput>({
    resolver: zodResolver(cashOpeningSchema),
    defaultValues: { date, amount },
  });

  useEffect(() => {
    form.reset({ date, amount });
  }, [date, amount, form]);

  const onSubmit = async (values: CashOpeningInput) => {
    setIsSubmitting(true);
    const result = await setCashOpeningAction(values);
    setIsSubmitting(false);
    if (!result.success) {
      form.setError("amount", { message: result.error ?? "No se pudo guardar el cambio." });
      return;
    }
    toast.success("Cambio inicial guardado");
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xl font-bold">{formatMoney(amount)}</span>
        {canEdit && (
          <Button variant="ghost" size="icon" aria-label="Editar el cambio inicial" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2" noValidate>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Cambio inicial</FormLabel>
              <FormControl>
                <Input type="number" inputMode="decimal" min={0} step="any" className="font-mono" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="icon" aria-label="Guardar el cambio inicial" disabled={isSubmitting}>
          <Check />
        </Button>
      </form>
    </Form>
  );
}

/** Anular un movimiento manual: queda tachado, nunca se borra. Solo admin. */
export function VoidMovementButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVoid = async () => {
    setIsSubmitting(true);
    const result = await voidCashMovementAction(id);
    setIsSubmitting(false);
    setOpen(false);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo anular el movimiento.");
      return;
    }
    toast.success("Movimiento anulado");
  };

  return (
    <>
      <Button variant="ghost" size="icon" aria-label={`Anular ${label}`} onClick={() => setOpen(true)}>
        <Ban />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de sumar en la caja y queda tachado en la lista (no se borra). Si hubo un error, anulalo y
              cargalo de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mejor no</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} variant="destructive" disabled={isSubmitting}>
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
