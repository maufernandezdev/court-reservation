"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import type { Product } from "@/lib/cash";
import { formatMoney } from "@/lib/pricing";
import { saveProductAction, setProductActiveAction } from "@/app/dashboard/productos/actions";
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
import { cn } from "@/lib/utils";

const productFormSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre del producto").max(80, "Hasta 80 caracteres"),
  price: z.coerce
    .number({ message: "Ingresá un precio válido" })
    .positive("El precio tiene que ser mayor a 0")
    .max(100_000_000, "El precio es demasiado alto")
    .refine((value) => Number.isInteger(value * 100), "Hasta dos decimales"),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

function ProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState("");
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { name: "", price: 0 },
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset({ name: product?.name ?? "", price: product?.price ?? 0 });
  }, [open, product]);

  const onSubmit = async (values: ProductFormValues) => {
    setError("");
    const result = await saveProductAction(values, product?.id);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar el producto.");
      return;
    }
    toast.success(product ? "Producto actualizado" : `Producto agregado: ${values.name.trim()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>Al registrar una venta en Caja se elige el producto y el precio viene cargado.</DialogDescription>
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
                    <Input placeholder="Tubo de pelotas" autoComplete="off" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
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
                      value={field.value === 0 ? "" : String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

/** Catálogo de productos del club: alta, edición y activar/desactivar. */
export function ProductManager({ products }: { products: Product[] }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const openDialog = (product: Product | null) => {
    setEditing(product);
    setOpen(true);
  };

  const toggle = (product: Product) =>
    startTransition(async () => {
      const result = await setProductActiveAction(product.id, !product.active);
      if (!result.success) toast.error(result.error ?? "No se pudo cambiar el producto.");
      else toast.success(product.active ? `${product.name}: ya no se ofrece` : `${product.name}: se vuelve a ofrecer`);
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => openDialog(null)}>
          <Plus />
          Nuevo producto
        </Button>
      </div>
      <section aria-label="Productos" className="overflow-hidden rounded-2xl border bg-card">
        {products.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            Todavía no hay productos. Agregá los que se venden (pelotas, grips, bebidas…) con su precio.
          </p>
        ) : (
          <ul>
            {products.map((product) => (
              <li
                key={product.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-muted px-5 py-3.5 first:border-t-0",
                  !product.active && "text-muted-foreground"
                )}
              >
                <strong className="min-w-0 flex-[1_1_180px] truncate text-[15px]">{product.name}</strong>
                {!product.active && <Badge variant="outline">No se ofrece</Badge>}
                <span className="ml-auto font-mono text-base">{formatMoney(product.price)}</span>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => openDialog(product)} aria-label={`Editar ${product.name}`}>
                    <Pencil />
                  </Button>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle(product)}>
                    {product.active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ProductDialog product={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}
