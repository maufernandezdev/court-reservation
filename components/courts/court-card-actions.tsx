"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  courtSchema,
  type Court,
  type CourtInput,
} from "@/lib/courts";
import {
  updateCourtAction,
  deactivateCourtAction,
} from "@/app/dashboard/canchas/actions";
import { CourtFormFields } from "@/components/courts/court-form-fields";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

function toFormValues(court: Court): CourtInput {
  return {
    name: court.name,
    type: court.type,
    price_per_hour: court.price_per_hour,
    slot_duration: court.slot_duration,
    open_time: court.open_time,
    close_time: court.close_time,
    deposit_enabled: court.deposit_enabled,
    deposit_type: court.deposit_type,
    deposit_value: court.deposit_value,
  };
}

export function CourtCardActions({ court }: { court: Court }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourtInput>({
    resolver: zodResolver(courtSchema),
    defaultValues: toFormValues(court),
  });

  const openEditDialog = () => {
    setFormError("");
    form.reset(toFormValues(court));
    setEditDialogOpen(true);
  };

  const handleSubmit = async (values: CourtInput) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error } = await updateCourtAction(court.id, values);

    if (success) {
      setEditDialogOpen(false);
      toast.success(`La cancha "${values.name.trim()}" se actualizó correctamente`);
    } else {
      setFormError(error ?? "No se pudo actualizar la cancha.");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    const { success, error } = await deactivateCourtAction(court.id);

    if (success) {
      setDeleteDialogOpen(false);
      toast.success(`La cancha "${court.name}" se dio de baja`);
    } else {
      setDeleteDialogOpen(false);
      toast.error(error ?? "No se pudo eliminar la cancha.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${court.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openEditDialog}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Dar de baja
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cancha</DialogTitle>
            <DialogDescription>
              Modificá el precio, los horarios o la seña de la cancha.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <CourtFormFields form={form} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja {court.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              La cancha va a dejar de mostrarse en el panel, pero sus datos y
              sus reservas quedan guardados en la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructive"
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
