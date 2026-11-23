"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  CASH_CATEGORY_LABELS,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  COUNTERPARTY_REQUIRED,
  PAYEE_KIND_BY_CATEGORY,
  cashExpenseSchema,
  cashSaleSchema,
  type CashExpenseInput,
  type CashSaleInput,
  type PayeeKind,
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

/** Producto del catálogo que se ofrece en "Registrar venta". */
export type SaleProduct = { id: string; name: string; price: number };
/** A quién se le puede pagar una salida: el equipo (con o sin acceso a la app) y los proveedores. */
export type PayeeOption = { name: string; kind: PayeeKind };

/** Valor del selector de producto para cargar algo que no está en el catálogo. */
const OTHER = "__otro";

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

/** "Registrar venta": se elige un producto del catálogo (el precio viene cargado) u otro ingreso. Admin y operador. */
export function CashSaleDialog({
  date,
  products,
  canEditProducts,
}: {
  date: string;
  products: SaleProduct[];
  canEditProducts: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const empty: CashSaleInput = {
    date,
    category: "accesorio",
    concept: "",
    unit_price: 0,
    quantity: 1,
    method: "efectivo",
  };
  const form = useForm<CashSaleInput>({ resolver: zodResolver(cashSaleSchema), defaultValues: empty });
  const [unitPrice, quantity] = useWatch({ control: form.control, name: ["unit_price", "quantity"] });
  const total = (Number(unitPrice) || 0) * (Number(quantity) || 1);
  const isOther = productId === OTHER;

  useEffect(() => {
    if (!open) return;
    setError("");
    setProductId(products.length === 0 ? OTHER : "");
    form.reset({ ...empty, date });
  }, [open, date]);

  const chooseProduct = (value: string) => {
    setProductId(value);
    const product = products.find((p) => p.id === value);
    if (product) {
      form.setValue("category", "accesorio");
      form.setValue("concept", product.name, { shouldValidate: true });
      form.setValue("unit_price", product.price, { shouldValidate: true });
    } else {
      form.setValue("concept", "");
      form.setValue("unit_price", 0);
    }
  };

  const onSubmit = async (values: CashSaleInput) => {
    setError("");
    if (!productId) {
      setError("Elegí el producto que se vendió.");
      return;
    }
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
            {products.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span id="sale-product-label" className="text-sm font-medium">
                  Producto
                </span>
                <Select value={productId} onValueChange={chooseProduct}>
                  <SelectTrigger className="w-full" aria-labelledby="sale-product-label">
                    <SelectValue placeholder="Elegí el producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatMoney(p.price)}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER}>Otro (escribirlo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                Todavía no hay productos cargados.
                {canEditProducts && (
                  <>
                    {" "}
                    Cargalos en{" "}
                    <Link href="/dashboard/productos" className="font-medium text-foreground underline">
                      Productos
                    </Link>{" "}
                    y el precio va a venir solo.
                  </>
                )}
              </p>
            )}
            {isOther && (
              <>
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
                      <FormLabel>Qué se vendió</FormLabel>
                      <FormControl>
                        <Input placeholder="Tubo de pelotas" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            {productId && (
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
            )}
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
export function CashExpenseDialog({ date, payees }: { date: string; payees: PayeeOption[] }) {
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
  const [category, counterparty] = useWatch({ control: form.control, name: ["category", "counterparty"] });
  const required = COUNTERPARTY_REQUIRED.has(category);

  // Sugerencias: los del tipo que corresponde a la categoría, filtrados por lo que se va escribiendo.
  const matches = useMemo(() => {
    const kind = PAYEE_KIND_BY_CATEGORY[category];
    const query = normalize(counterparty ?? "");
    return payees
      .filter((p) => (kind ? p.kind === kind : true))
      .filter((p) => (query ? normalize(p.name).includes(query) && normalize(p.name) !== query : true))
      .slice(0, 8);
  }, [category, counterparty, payees]);

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
                  <FormLabel>A quién{required ? "" : " (opcional)"}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={category === "liquidacion_profe" ? "Nombre del profe" : "Persona o comercio"}
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  {matches.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Equipo y proveedores">
                      {matches.map((p) => (
                        <Button
                          key={`${p.kind}-${p.name}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full text-xs"
                          onClick={() => form.setValue("counterparty", p.name, { shouldValidate: true })}
                        >
                          {p.name}
                          {PAYEE_KIND_BY_CATEGORY[category] ? "" : ` · ${p.kind === "proveedor" ? "Proveedor" : "Equipo"}`}
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
