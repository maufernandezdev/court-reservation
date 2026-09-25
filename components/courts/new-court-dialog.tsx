"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { courtSchema, type CourtInput, COURT_TYPES, COURT_TYPE_LABELS } from "@/lib/courts";
import { createCourtAction } from "@/app/dashboard/canchas/actions";
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

export function NewCourtDialog({ triggerLabel }: { triggerLabel: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourtInput>({
    resolver: zodResolver(courtSchema),
    defaultValues: { name: "", type: undefined },
  });

  const openDialog = () => {
    setFormError("");
    form.reset();
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: CourtInput) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error } = await createCourtAction(values);

    if (success) {
      setIsDialogOpen(false);
      form.reset();
      toast.success(`La cancha "${values.name.trim()}" se creó correctamente`);
    } else {
      setFormError(error ?? "No se pudo crear la cancha.");
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Button onClick={openDialog}>
        <Plus className="mr-2 h-4 w-4" />
        {triggerLabel}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cancha</DialogTitle>
          <DialogDescription>
            Agregá una cancha a tu club. Podés crear todas las que necesites.
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
                    <Input
                      placeholder="Cancha 1"
                      autoFocus
                      {...field}
                    />
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
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar cancha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
