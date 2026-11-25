"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { setSettleFromAction } from "@/app/dashboard/liquidaciones/actions";
import { ProcessingButton } from "@/components/processing-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateInput, formatDateKeyAR } from "@/components/ui/date-input";
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

const settleFromFormSchema = z.object({
  settleFrom: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha válida"), z.literal("")]),
});
type SettleFromFormValues = z.infer<typeof settleFromFormSchema>;

/** "Liquidar desde": lo anterior a esta fecha no cuenta como deuda de los profes. */
export function SettleFromDialog({ settleFrom }: { settleFrom: string | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<SettleFromFormValues>({
    resolver: zodResolver(settleFromFormSchema),
    defaultValues: { settleFrom: settleFrom ?? "" },
  });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: SettleFromFormValues) => {
    setError("");
    const result = await setSettleFromAction(values);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar la fecha.");
      return;
    }
    toast.success(values.settleFrom ? `Se liquida desde el ${formatDateKeyAR(values.settleFrom)}` : "Sin fecha de inicio");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (next) {
          setError("");
          form.reset({ settleFrom: settleFrom ?? "" });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays />
          {settleFrom ? `Liquidar desde el ${formatDateKeyAR(settleFrom)}` : "Fijar “Liquidar desde”"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liquidar desde</DialogTitle>
          <DialogDescription>
            Los turnos anteriores a esta fecha no cuentan como deuda de los profes: los arregla el club por su cuenta.
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
              name="settleFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de inicio</FormLabel>
                  <DateInput value={field.value} onChange={field.onChange} disabled={submitting} aria-label="Fecha de inicio" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              {settleFrom && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => form.setValue("settleFrom", "")}
                  className="sm:mr-auto"
                >
                  Quitar fecha
                </Button>
              )}
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <ProcessingButton type="submit" processing={submitting} processingLabel="Guardando…">
                Guardar
              </ProcessingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
