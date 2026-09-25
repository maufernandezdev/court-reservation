"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  courtSchema,
  type Court,
  type CourtInput,
  COURT_TYPES,
  COURT_TYPE_LABELS,
} from "@/lib/courts";
import {
  updateCourtAction,
  deactivateCourtAction,
} from "@/app/dashboard/canchas/actions";
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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CourtCardActions({ court }: { court: Court }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourtInput>({
    resolver: zodResolver(courtSchema),
    defaultValues: { name: court.name, type: court.type },
  });

  const openEditDialog = () => {
    setFormError("");
    form.reset({ name: court.name, type: court.type });
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
      toast.success(`La cancha "${court.name}" se eliminó correctamente`);
    } else {
      setDeleteDialogOpen(false);
      toast.error(error ?? "No se pudo eliminar la cancha.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Opciones">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Opciones de la cancha</span>
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
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cancha</DialogTitle>
            <DialogDescription>
              Modificá el nombre o el tipo de la cancha.
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
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Cancha 1" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Controller
                control={form.control}
                name="type"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccioná un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COURT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {COURT_TYPE_LABELS[type]}
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
            <AlertDialogTitle>¿Eliminar cancha?</AlertDialogTitle>
            <AlertDialogDescription>
              La cancha va a dejar de mostrarse en el panel, pero sus datos y
              sus reservas quedan guardados en la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
