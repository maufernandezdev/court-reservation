"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth-guard";
import { useMembership } from "@/hooks/use-membership";
import { createClient } from "@/lib/supabase/client";
import {
  memberInviteSchema,
  type MemberInviteInput,
  type MemberWithEmail,
} from "@/lib/members";
import {
  CLUB_ROLES,
  CLUB_ROLE_LABELS,
  ROLE_CAPABILITIES,
  type ClubRole,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  createInvitationAction,
  regenerateInvitationAction,
  removeMemberAction,
  revokeInvitationAction,
  updateMemberRoleAction,
} from "@/app/dashboard/miembros/actions";
import type { ClubInvitation, SharedInvitation } from "@/lib/invitations";
import { InvitationShare } from "@/components/members/invitation-share";
import { PendingInvitations } from "@/components/members/pending-invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/shell/page-header";

function initials(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export default function MiembrosPage() {
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const isAdmin = membership?.role === "admin";

  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
  const [shared, setShared] = useState<SharedInvitation | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ClubInvitation | null>(null);

  const supabase = createClient();

  const loadMembers = useCallback(async () => {
    if (!membership) return;
    setIsLoadingMembers(true);
    const { data } = await supabase
      .from("memberships")
      .select("*")
      .eq("club_id", membership.club_id)
      .order("created_at", { ascending: true });
    setMembers((data ?? []) as MemberWithEmail[]);

    // Abiertas = ni aceptadas ni canceladas (las vencidas se muestran para renovarlas).
    const { data: invitationsData } = await supabase
      .from("club_invitations")
      .select("id, email, full_name, role, created_at, expires_at")
      .eq("club_id", membership.club_id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setInvitations((invitationsData ?? []) as ClubInvitation[]);
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
    setShared(null);
    form.reset({ email: "", full_name: "", role: "operador" });
    setInviteOpen(true);
  };

  const handleInvite = async (values: MemberInviteInput) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error, invitation } = await createInvitationAction(values);

    if (success && invitation) {
      setShared(invitation);
      await loadMembers();
    } else {
      setFormError(error ?? "No se pudo crear la invitación.");
    }
    setIsSubmitting(false);
  };

  const handleRegenerate = async (invitation: ClubInvitation) => {
    setBusyInvitationId(invitation.id);
    const { success, error, invitation: renewed } = await regenerateInvitationAction(invitation.id);
    setBusyInvitationId(null);

    if (success && renewed) {
      setShared(renewed);
      setInviteOpen(true);
      await loadMembers();
    } else {
      toast.error(error ?? "No se pudo generar el link");
    }
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    setBusyInvitationId(revoking.id);
    const { success, error } = await revokeInvitationAction(revoking.id);
    setBusyInvitationId(null);
    setRevoking(null);

    if (success) {
      toast.success("Invitación cancelada");
    } else {
      toast.error(error ?? "No se pudo cancelar la invitación");
    }
    await loadMembers();
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
        <PageHeader
          title="Equipo"
          description="Quién entra al panel y qué puede hacer cada uno."
          actions={
            <Button onClick={openInvite}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invitar persona
            </Button>
          }
        />

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
            <section
              aria-label="Personas del club"
              className="overflow-hidden rounded-2xl border bg-card"
            >
              {members.length === 0 ? (
                <p className="flex items-center gap-2 p-5 text-muted-foreground">
                  <Users className="size-4" />
                  Todavía no hay miembros cargados.
                </p>
              ) : (
                <ul className="divide-y">
                  {members.map((member) => {
                    const name = member.full_name || member.email;
                    const isMe = member.user_id === membership?.user_id;
                    return (
                      <li
                        key={member.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                            member.role === "profesor"
                              ? "bg-line text-line-foreground"
                              : "bg-ink text-primary-foreground"
                          )}
                        >
                          {initials(name)}
                        </span>
                        <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                          <strong className="flex items-center gap-2 truncate text-[15px]">
                            {name}
                            {isMe && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                                Vos
                              </span>
                            )}
                          </strong>
                          {member.full_name && (
                            <span className="truncate text-[13px] text-muted-foreground">
                              {member.email}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={member.role}
                            onValueChange={(role) => handleRoleChange(member.id, role as ClubRole)}
                          >
                            <SelectTrigger
                              size="sm"
                              className="w-40"
                              aria-label={`Rol de ${name}`}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "size-2 rounded-full",
                                  member.role === "admin"
                                    ? "bg-ink"
                                    : member.role === "profesor"
                                      ? "bg-line"
                                      : "bg-muted-foreground"
                                )}
                              />
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
                            size="icon-sm"
                            aria-label={`Quitar a ${name} del club`}
                            disabled={isMe}
                            onClick={() => setRemovingId(member.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <PendingInvitations
              invitations={invitations}
              busyId={busyInvitationId}
              onRegenerate={handleRegenerate}
              onRevoke={setRevoking}
            />
          </div>

          <section
            aria-labelledby="permisos"
            className="flex flex-[1_1_380px] flex-col gap-4 rounded-2xl border bg-card p-5"
          >
            <h2 id="permisos" className="text-lg font-bold">
              Qué puede hacer cada rol
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="font-mono text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-medium">
                    <span className="sr-only">Permiso</span>
                  </th>
                  {CLUB_ROLES.map((role) => (
                    <th key={role} scope="col" className="w-[72px] px-1 py-2 font-medium uppercase">
                      {role === "admin" ? "Admin" : role === "operador" ? "Oper." : "Profe"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_CAPABILITIES.map((cap) => (
                  <tr key={cap.label} className="border-t border-muted">
                    <th scope="row" className="py-2.5 text-left font-medium">
                      {cap.label}
                    </th>
                    {CLUB_ROLES.map((role) => {
                      const value = cap.access[role];
                      return (
                        <td key={role} className="px-1 py-2 text-center">
                          {value === true ? (
                            <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-ink text-ball">
                              <Check className="size-3.5" strokeWidth={3} />
                              <span className="sr-only">Sí</span>
                            </span>
                          ) : value === false ? (
                            <span className="text-muted-foreground">
                              <span aria-hidden="true">—</span>
                              <span className="sr-only">No</span>
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-line-soft px-1.5 py-0.5 text-[11px] font-bold text-line-soft-foreground">
                              {value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Los profesores no pueden cancelar dentro de la ventana de penalidad
              ni turnos que ya tienen cobros: se lo piden a un operador.
            </p>
          </section>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shared ? "Invitación lista" : "Invitar al equipo"}</DialogTitle>
            <DialogDescription>
              {shared
                ? "Compartí el link por WhatsApp o copialo en un correo."
                : "Generamos un link personal para que entre al club con su correo. No hace falta que tenga cuenta."}
            </DialogDescription>
          </DialogHeader>
          {shared ? (
            <>
              <InvitationShare invitation={shared} clubName={membership!.club.name} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Listo
                </Button>
              </DialogFooter>
            </>
          ) : (
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
                      <FormLabel>Correo</FormLabel>
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
                    {isSubmitting ? "Generando link…" : "Generar invitación"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removingId !== null}
        onOpenChange={(open) => !open && setRemovingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a esta persona del club?</AlertDialogTitle>
            <AlertDialogDescription>
              La persona va a perder el acceso a la operación del club. Sus
              acciones anteriores quedan registradas en la auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              variant="destructive"
            >
              Quitar del club
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la invitación?</AlertDialogTitle>
            <AlertDialogDescription>
              El link que le mandaste a {revoking?.full_name || revoking?.email} deja de
              servir. Si cambiás de idea, podés invitarla de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mejor no</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} variant="destructive">
              Cancelar invitación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthGuard>
  );
}
