"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { PAYEE_KINDS, PAYEE_KIND_LABELS, type Payee, type PayeeKind } from "@/lib/cash";
import { savePayeeAction, setPayeeActiveAction } from "@/app/dashboard/proveedores/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const payeeFormSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre").max(80, "Hasta 80 caracteres"),
  kind: z.enum(PAYEE_KINDS, { message: "Elegí si es empleado, profe o proveedor" }),
});
type PayeeFormValues = z.infer<typeof payeeFormSchema>;

function PayeeDialog({
  payee,
  kinds,
  title,
  open,
  onOpenChange,
}: {
  payee: Payee | null;
  kinds: readonly PayeeKind[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState("");
  const form = useForm<PayeeFormValues>({
    resolver: zodResolver(payeeFormSchema),
    defaultValues: { name: "", kind: kinds[0] },
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset({ name: payee?.name ?? "", kind: payee?.kind ?? kinds[0] });
  }, [open, payee]);

  const onSubmit = async (values: PayeeFormValues) => {
    setError("");
    const result = await savePayeeAction(values, payee?.id);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar.");
      return;
    }
    toast.success(payee ? "Datos actualizados" : `Agregado: ${values.name.trim()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payee ? "Editar" : title}</DialogTitle>
          <DialogDescription>Aparece para elegir al registrar una salida en Caja.</DialogDescription>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Persona o comercio" autoComplete="off" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {kinds.length > 1 && (
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kinds.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {PAYEE_KIND_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lista de a quién se le paga (sin cuenta en la app). La usan Equipo (empleados y profes sin acceso,
 * con "Darle acceso") y Proveedores.
 */
export function PayeeManager({
  payees,
  kinds,
  addLabel,
  dialogTitle,
  emptyText,
  label,
  showKind,
  onGrantAccess,
}: {
  payees: Payee[];
  kinds: readonly PayeeKind[];
  addLabel: string;
  dialogTitle: string;
  emptyText: string;
  label: string;
  showKind: boolean;
  onGrantAccess?: (payee: Payee) => void;
}) {
  const [editing, setEditing] = useState<Payee | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const openDialog = (payee: Payee | null) => {
    setEditing(payee);
    setOpen(true);
  };

  const toggle = (payee: Payee) =>
    startTransition(async () => {
      const result = await setPayeeActiveAction(payee.id, !payee.active);
      if (!result.success) toast.error(result.error ?? "No se pudo guardar.");
      else toast.success(payee.active ? `${payee.name}: dado de baja` : `${payee.name}: vuelve a estar activo`);
    });

  return (
    <div className="flex flex-col gap-3">
      <section aria-label={label} className="overflow-hidden rounded-2xl border bg-card">
        {payees.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul>
            {payees.map((payee) => (
              <li
                key={payee.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-muted px-5 py-3.5 first:border-t-0",
                  !payee.active && "text-muted-foreground"
                )}
              >
                <strong className="min-w-0 flex-[1_1_180px] truncate text-[15px]">{payee.name}</strong>
                {showKind && <Badge variant="outline">{PAYEE_KIND_LABELS[payee.kind]}</Badge>}
                {!payee.active && <Badge variant="outline">De baja</Badge>}
                <div className="ml-auto flex gap-1.5">
                  {onGrantAccess && payee.active && (
                    <Button variant="outline" size="sm" onClick={() => onGrantAccess(payee)}>
                      <KeyRound />
                      Darle acceso
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openDialog(payee)} aria-label={`Editar ${payee.name}`}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => toggle(payee)}>
                    {payee.active ? "Dar de baja" : "Reactivar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div>
        <Button variant="outline" onClick={() => openDialog(null)}>
          <Plus />
          {addLabel}
        </Button>
      </div>
      <PayeeDialog payee={editing} kinds={kinds} title={dialogTitle} open={open} onOpenChange={setOpen} />
    </div>
  );
}
