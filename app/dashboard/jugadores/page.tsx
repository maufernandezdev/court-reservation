"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth-guard";
import { useMembership } from "@/hooks/use-membership";
import { createClient } from "@/lib/supabase/client";
import { normalizeDni, type Player } from "@/lib/players";
import { removePlayerAction } from "@/app/dashboard/jugadores/actions";
import { PlayerDialog } from "@/components/players/player-dialog";
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

export default function PlayersPage() {
  const { membership } = useMembership();
  const isProfe = membership.role === "profesor";
  // El staff modifica a todos; el profe, solo a los que agregó él.
  const canEdit = (player: Player) => !isProfe || player.created_by === membership.user_id;
  const supabase = createClient();

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [removing, setRemoving] = useState<Player | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("players")
      .select("id, club_id, full_name, dni, phone, email, created_by, created_at, updated_at")
      .eq("club_id", membership.club_id)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });
    setLoadError(error ? "No se pudieron cargar los jugadores." : "");
    setPlayers((data ?? []) as Player[]);
    setIsLoading(false);
  }, [supabase, membership.club_id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = fold(search.trim());
    if (!term) return players;
    const dniTerm = normalizeDni(search.trim());
    const digits = term.replace(/\D/g, "");
    return players.filter(
      (s) =>
        fold(s.full_name).includes(term) ||
        s.dni.includes(dniTerm) ||
        (digits.length > 0 && s.phone.replace(/\D/g, "").includes(digits))
    );
  }, [players, search]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleRemove = async () => {
    if (!removing) return;
    const result = await removePlayerAction(removing.id);
    if (result.success) {
      toast.success(`${removing.full_name} ya no figura como jugador`);
      await load();
    } else {
      toast.error(result.error ?? "No se pudo dar de baja el jugador");
    }
    setRemoving(null);
  };

  return (
    <AuthGuard>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Jugadores"
          description={
            isProfe
              ? "Cargá a tus alumnos para elegirlos al crear un turno. Ves a todos los jugadores del club y modificás solo a los que agregaste vos."
              : "Los jugadores del club. Al cargar un turno se buscan por nombre o DNI."
          }
          actions={
            <Button onClick={openNew}>
              <UserPlus />
              Agregar jugador
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
            aria-label="Buscar jugador"
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
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Todavía no hay jugadores cargados</h2>
              <p className="text-muted-foreground">
                Cargalos para encontrarlos rápido al reservar un turno.
              </p>
            </div>
            <Button onClick={openNew}>
              <UserPlus />
              Agregar el primer jugador
            </Button>
          </div>
        ) : (
          <section aria-label="Jugadores del club" className="overflow-hidden rounded-2xl border bg-card">
            <p className="border-b px-5 py-3 font-mono text-[13px] text-muted-foreground">
              {filtered.length === players.length
                ? `${players.length} ${players.length === 1 ? "jugador" : "jugadores"}`
                : `${filtered.length} de ${players.length}`}
            </p>
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Ningún jugador coincide con la búsqueda.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((player) => (
                  <li
                    key={player.id}
                    className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3.5"
                  >
                    <strong className="min-w-0 flex-[1_1_200px] truncate text-[15px]">
                      {player.full_name}
                    </strong>
                    <span className="w-28 font-mono text-sm text-muted-foreground">
                      {player.dni ? `DNI ${player.dni}` : "Sin DNI"}
                    </span>
                    <span className="w-36 font-mono text-sm text-muted-foreground">
                      {player.phone || "Sin teléfono"}
                    </span>
                    <span className="min-w-0 flex-[1_1_160px] truncate text-sm text-muted-foreground">
                      {player.email}
                    </span>
                    {canEdit(player) && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar a ${player.full_name}`}
                        onClick={() => {
                          setEditing(player);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Dar de baja a ${player.full_name}`}
                        onClick={() => setRemoving(player)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <PlayerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        player={editing}
        onSaved={async (name) => {
          setDialogOpen(false);
          toast.success(editing ? `Datos de ${name} guardados` : `${name} se agregó a Jugadores`);
          await load();
        }}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja a {removing?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en Jugadores y en el buscador de turnos. Los turnos donde participó
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
