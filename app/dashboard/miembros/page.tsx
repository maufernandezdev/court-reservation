"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth-guard";
import { useMembership } from "@/hooks/use-membership";
import { createClient } from "@/lib/supabase/client";
import {
  memberInviteSchema,
  type MemberInviteInput,
  type MemberWithEmail,
} from "@/lib/members";
import { CLUB_ROLES, CLUB_ROLE_LABELS, type ClubRole } from "@/lib/roles";
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/dashboard/miembros/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function MiembrosPage() {
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const isAdmin = membership?.role === "admin";

  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const supabase = createClient();

  const loadMembers = useCallback(async () => {
    if (!membership) return;
    setIsLoadingMembers(true);
    const { data } = await supabase
      .from("memberships")
      .select("*")
      .eq("owner_id", membership.owner_id)
      .order("created_at", { ascending: true });
    setMembers((data ?? []) as MemberWithEmail[]);
    setIsLoadingMembers(false);
  }, [supabase, membership]);

  useEffect(() => {
    if (isAdmin) loadMembers();
  }, [isAdmin, loadMembers]);

  const form = useForm<MemberInviteInput>({
    resolver: zodResolver(memberInviteSchema),
    defaultValues: { email: "", full_name: "", role: "operador" },
  });

  const openInvite = () => {
    setFormError("");
    form.reset({ email: "", full_name: "", role: "operador" });
    setInviteOpen(true);
  };

  const handleInvite = async (values: MemberInviteInput) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error } = await inviteMemberAction(values);

    if (success) {
      setInviteOpen(false);
      toast.success(`${values.full_name} ya es miembro del club`);
      await loadMembers();
    } else {
      setFormError(error ?? "No se pudo agregar al miembro.");
    }
    setIsSubmitting(false);
  };

  const handleRoleChange = async (memberId: string, role: ClubRole) => {
    const { success, error } = await updateMemberRoleAction(memberId, role);

    if (success) {
      toast.success("Rol actualizado");
      await loadMembers();
    } else {
      toast.error(error ?? "No se pudo actualizar el rol");
    }
  };

  const handleRemove = async () => {
    if (!removingId) return;
    const { success, error } = await removeMemberAction(removingId);

    if (success) {
      toast.success("Miembro eliminado del club");
    } else {
      toast.error(error ?? "No se pudo eliminar al miembro");
    }
    setRemovingId(null);
    await loadMembers();
  };

  if (isLoadingMembership || (isAdmin && isLoadingMembers)) {
    return (
      <AuthGuard>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Solo los administradores pueden gestionar los miembros del club.
          </AlertDescription>
        </Alert>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Miembros</h1>
            <p className="text-sm text-muted-foreground">
              Administradores, operadores y profesores que gestionan el club
            </p>
          </div>
          <Button onClick={openInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Agregar miembro
          </Button>
        </div>

        {members.length === 0 ? (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              Todavía no hay miembros cargados.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {member.full_name || member.email}
                    </span>
                    <Badge
                      variant={
                        member.role === "admin" ? "default" : "secondary"
                      }
                    >
                      {CLUB_ROLE_LABELS[member.role]}
                    </Badge>
                    {member.user_id === membership?.user_id && (
                      <Badge variant="outline">Vos</Badge>
                    )}
                  </div>
                  {member.full_name && (
                    <p className="truncate text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(role) =>
                      handleRoleChange(member.id, role as ClubRole)
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLUB_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {CLUB_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Eliminar del club"
                    disabled={member.user_id === membership?.user_id}
                    onClick={() => setRemovingId(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar miembro</DialogTitle>
            <DialogDescription>
              La persona debe tener una cuenta registrada con ese email. Después
              de agregarla, va a poder operar el club con el rol que elijas.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleInvite)}
              className="space-y-4"
            >
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre y apellido</FormLabel>
                    <FormControl>
                      <Input placeholder="Diego Pérez" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (de su cuenta registrada)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="diego@club.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Controller
                control={form.control}
                name="role"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccioná un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CLUB_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {CLUB_ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && (
                      <FormMessage>{fieldState.error.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Agregando..." : "Agregar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removingId !== null}
        onOpenChange={(open) => !open && setRemovingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
            <AlertDialogDescription>
              La persona va a perder el acceso a la operación del club. Sus
              acciones anteriores quedan registradas en la auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthGuard>
  );
}
