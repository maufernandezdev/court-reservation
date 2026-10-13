"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth-guard";
import { useMembership } from "@/hooks/use-membership";
import { createClient } from "@/lib/supabase/client";
import { normalizeDni, type Socio } from "@/lib/socios";
import { roleAtLeast } from "@/lib/roles";
import { removeSocioAction } from "@/app/dashboard/socios/actions";
import { SocioDialog } from "@/components/socios/socio-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

/** Coincidencia sin tildes ni mayúsculas. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function SociosPage() {
  const { membership } = useMembership();
  const canManage = roleAtLeast(membership.role, "operador");
  const supabase = createClient();

  const [socios, setSocios] = useState<Socio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Socio | null>(null);
  const [removing, setRemoving] = useState<Socio | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("socios")
      .select("id, club_id, full_name, dni, phone, email, created_at, updated_at")
      .eq("club_id", membership.club_id)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });
    setLoadError(error ? "No se pudieron cargar los socios." : "");
    setSocios((data ?? []) as Socio[]);
    setIsLoading(false);
  }, [supabase, membership.club_id]);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const filtered = useMemo(() => {
    const term = fold(search.trim());
    if (!term) return socios;
    const dniTerm = normalizeDni(search.trim());
    const digits = term.replace(/\D/g, "");
    return socios.filter(
      (s) =>
        fold(s.full_name).includes(term) ||
        s.dni.includes(dniTerm) ||
        (digits.length > 0 && s.phone.replace(/\D/g, "").includes(digits))
    );
  }, [socios, search]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleRemove = async () => {
    if (!removing) return;
    const result = await removeSocioAction(removing.id);
    if (result.success) {
      toast.success(`${removing.full_name} ya no figura como socio`);
      await load();
    } else {
      toast.error(result.error ?? "No se pudo dar de baja el socio");
    }
    setRemoving(null);
  };

  if (!canManage) {
    return (
      <AuthGuard>
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertDescription>Solo el administrador y los operadores gestionan los socios.</AlertDescription>
        </Alert>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Socios"
          description="Los socios del club. Al cargar un turno se buscan por nombre o DNI."
          actions={
            <Button onClick={openNew}>
              <UserPlus />
              Agregar socio
            </Button>
          }
        />

        <div className="relative max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar socio"
            placeholder="Buscar por nombre, DNI o teléfono"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : socios.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Todavía no hay socios cargados</h2>
              <p className="text-muted-foreground">
                Cargalos para encontrarlos rápido al reservar un turno.
              </p>
            </div>
            <Button onClick={openNew}>
              <UserPlus />
              Agregar el primer socio
            </Button>
          </div>
        ) : (
          <section aria-label="Socios del club" className="overflow-hidden rounded-2xl border bg-card">
            <p className="border-b px-5 py-3 font-mono text-[13px] text-muted-foreground">
              {filtered.length === socios.length
                ? `${socios.length} ${socios.length === 1 ? "socio" : "socios"}`
                : `${filtered.length} de ${socios.length}`}
            </p>
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Ningún socio coincide con la búsqueda.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((socio) => (
                  <li
                    key={socio.id}
                    className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3.5"
                  >
                    <strong className="min-w-0 flex-[1_1_200px] truncate text-[15px]">
                      {socio.full_name}
                    </strong>
                    <span className="w-28 font-mono text-sm text-muted-foreground">
                      {socio.dni ? `DNI ${socio.dni}` : "Sin DNI"}
                    </span>
                    <span className="w-36 font-mono text-sm text-muted-foreground">
                      {socio.phone || "Sin teléfono"}
                    </span>
                    <span className="min-w-0 flex-[1_1_160px] truncate text-sm text-muted-foreground">
                      {socio.email}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar a ${socio.full_name}`}
                        onClick={() => {
                          setEditing(socio);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Dar de baja a ${socio.full_name}`}
                        onClick={() => setRemoving(socio)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <SocioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        socio={editing}
        onSaved={async (name) => {
          setDialogOpen(false);
          toast.success(editing ? `Datos de ${name} guardados` : `${name} ya es socio`);
          await load();
        }}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja a {removing?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en Socios y en el buscador de turnos. Los turnos donde participó
              conservan su nombre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mejor no</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} variant="destructive">
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthGuard>
  );
}
