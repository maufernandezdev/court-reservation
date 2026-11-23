import { ShieldAlert } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import type { Payee } from "@/lib/cash";
import { PageHeader } from "@/components/shell/page-header";
import { PayeeManager } from "@/components/cash/payee-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Proveedores" };

/** Proveedores: comercios y servicios a los que se les paga en Caja. Las personas van en Equipo. Solo el admin. */
export default async function SuppliersPage() {
  const { supabase, membership } = await getSessionContext();

  if (!membership || membership.role !== "admin") {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Solo los administradores pueden ver los proveedores.</AlertDescription>
      </Alert>
    );
  }

  const { data, error } = await supabase
    .from("cash_payees")
    .select("id, name, kind, active")
    .eq("club_id", membership.club_id)
    .eq("kind", "proveedor")
    .order("active", { ascending: false })
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proveedores"
        description="Comercios y servicios a los que se les paga desde la caja. El personal del club se carga en Equipo."
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>No se pudieron cargar los proveedores.</AlertDescription>
        </Alert>
      )}
      <PayeeManager
        payees={(data ?? []) as Payee[]}
        kinds={["proveedor"]}
        addLabel="Agregar proveedor"
        dialogTitle="Nuevo proveedor"
        emptyText="Todavía no hay proveedores. Agregalos para elegirlos al registrar una salida."
        label="Proveedores"
        showKind={false}
      />
    </div>
  );
}
