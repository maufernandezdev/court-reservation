"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { courtSchema, type CourtInput } from "@/lib/courts";
import { createCourtAction } from "@/app/dashboard/canchas/actions";
import { CourtFormFields } from "@/components/courts/court-form-fields";
import { COURT_FORM_DEFAULTS } from "@/components/courts/court-form-defaults";
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
  Form,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function NewCourtDialog({ triggerLabel }: { triggerLabel: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourtInput>({
    resolver: zodResolver(courtSchema),
    defaultValues: COURT_FORM_DEFAULTS,
  });

  const openDialog = () => {
    setFormError("");
    form.reset(COURT_FORM_DEFAULTS);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: CourtInput) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error } = await createCourtAction(values);

    if (success) {
      setIsDialogOpen(false);
      form.reset(COURT_FORM_DEFAULTS);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva cancha</DialogTitle>
          <DialogDescription>
            Agregá una cancha con su precio, horarios y configuración de seña.
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
