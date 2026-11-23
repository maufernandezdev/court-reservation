import { ShieldAlert } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import type { Product } from "@/lib/cash";
import { PageHeader } from "@/components/shell/page-header";
import { ProductManager } from "@/components/cash/product-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Productos" };

/** Productos: el catálogo de lo que se vende en la caja, con su precio. Solo el admin. */
export default async function ProductsPage() {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo los administradores pueden cargar productos.</AlertDescription>
      </Alert>
    );
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, active")
    .eq("club_id", membership.club_id)
    .order("active", { ascending: false })
    .order("name");
  const products = ((data ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price) }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos"
        description="Lo que se vende en la caja. Al registrar una venta se elige el producto y el precio viene cargado."
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>No se pudieron cargar los productos.</AlertDescription>
        </Alert>
      )}
      <ProductManager products={products} />
    </div>
  );
}
