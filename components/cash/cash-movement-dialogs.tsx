"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  CASH_CATEGORY_LABELS,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  cashExpenseSchema,
  cashSaleSchema,
  type CashExpenseInput,
  type CashSaleInput,
} from "@/lib/cash";
import { PAYMENT_METHOD_LABELS, VISIBLE_PAYMENT_METHODS, type VisiblePaymentMethod } from "@/lib/reservations";
import { formatMoney } from "@/lib/pricing";
import { registerCashExpenseAction, registerCashSaleAction } from "@/app/dashboard/caja/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Producto vendido antes, con su último precio por unidad (para sugerirlo). */
export type ProductSuggestion = { concept: string; unit_price: number };

function MethodToggle({
  value,
  onChange,
  labelId,
}: {
  value: VisiblePaymentMethod;
  onChange: (value: VisiblePaymentMethod) => void;
  labelId: string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      spacing={1}
      value={value}
      onValueChange={(v) => v && onChange(v as VisiblePaymentMethod)}
      aria-labelledby={labelId}
      className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
    >
      {VISIBLE_PAYMENT_METHODS.map((method) => (
        <ToggleGroupItem key={method} value={method} className="h-9 w-full">
          {PAYMENT_METHOD_LABELS[method]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "Registrar venta": accesorios (pelotas, grips, agua…) u otros ingresos. Admin y operador. */
export function CashSaleDialog({ date, suggestions }: { date: string; suggestions: ProductSuggestion[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const empty: CashSaleInput = {
    date,
    category: "accesorio",
    concept: "",
    unit_price: 0,
    quantity: 1,
    method: "efectivo",
  };
  const form = useForm<CashSaleInput>({ resolver: zodResolver(cashSaleSchema), defaultValues: empty });
  const [concept, unitPrice, quantity] = useWatch({
    control: form.control,
    name: ["concept", "unit_price", "quantity"],
  });
  const total = (Number(unitPrice) || 0) * (Number(quantity) || 1);

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset({ ...empty, date });
  }, [open, date]);

  const matches = useMemo(() => {
    const query = normalize(concept ?? "");
    return suggestions
      .filter((s) => (query ? normalize(s.concept).includes(query) && normalize(s.concept) !== query : true))
      .slice(0, 6);
  }, [concept, suggestions]);

  const onSubmit = async (values: CashSaleInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await registerCashSaleAction(values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo registrar la venta.");
      return;
    }
    toast.success(`Venta registrada: ${values.concept.trim()}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ArrowDownLeft />
          Registrar venta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar venta</DialogTitle>
          <DialogDescription>Accesorios, bebidas u otro ingreso que no es un turno.</DialogDescription>
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
              name="category"
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
                      {CASH_IN_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CASH_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="Tubo de pelotas" autoComplete="off" autoFocus {...field} />
                  </FormControl>
                  {matches.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Productos vendidos antes">
                      {matches.map((s) => (
                        <Button
                          key={s.concept}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full text-xs"
                          onClick={() => {
                            form.setValue("concept", s.concept, { shouldValidate: true });
                            form.setValue("unit_price", s.unit_price, { shouldValidate: true });
                          }}
                        >
                          {s.concept} · {formatMoney(s.unit_price)}
                        </Button>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        className="font-mono"
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="numeric" min={1} step={1} className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id="sale-method-label">Medio</FormLabel>
                  <MethodToggle value={field.value} onChange={field.onChange} labelId="sale-method-label" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="flex justify-between rounded-xl bg-muted px-4 py-3 text-sm">
              <span>Total</span>
              <strong className="font-mono">{formatMoney(total)}</strong>
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Registrar venta"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** "Registrar salida": liquidaciones, empleados, proveedores, gastos y retiros. Solo admin. */
export function CashExpenseDialog({ date, profeNames }: { date: string; profeNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const empty: CashExpenseInput = {
    date,
    category: "gasto_general",
    counterparty: "",
    amount: 0,
    method: "efectivo",
    note: "",
  };
  const form = useForm<CashExpenseInput>({ resolver: zodResolver(cashExpenseSchema), defaultValues: empty });
  const category = useWatch({ control: form.control, name: "category" });

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset({ ...empty, date });
  }, [open, date]);

  const onSubmit = async (values: CashExpenseInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await registerCashExpenseAction(values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo registrar la salida.");
      return;
    }
    toast.success(`Salida registrada: ${formatMoney(Number(values.amount))}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUpRight />
          Registrar salida
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar salida</DialogTitle>
          <DialogDescription>Plata que sale de la caja: liquidaciones, sueldos, proveedores, gastos o retiros.</DialogDescription>
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CASH_OUT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CASH_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="counterparty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>A quién (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder={category === "liquidacion_profe" ? "Nombre del profe" : "Persona o comercio"} autoComplete="off" {...field} />
                  </FormControl>
                  {category === "liquidacion_profe" && profeNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Profes del club">
                      {profeNames.map((name) => (
                        <Button
                          key={name}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full text-xs"
                          onClick={() => form.setValue("counterparty", name, { shouldValidate: true })}
                        >
                          {name}
                        </Button>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      step="any"
                      className="font-mono"
                      {...field}
                      value={field.value === 0 ? "" : field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id="expense-method-label">Medio</FormLabel>
                  <MethodToggle value={field.value} onChange={field.onChange} labelId="expense-method-label" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Ej.: clases de la semana" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Registrar salida"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
