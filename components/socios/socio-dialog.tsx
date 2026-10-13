"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { socioSchema, type Socio, type SocioInput } from "@/lib/socios";
import { createSocioAction, updateSocioAction } from "@/app/dashboard/socios/actions";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const EMPTY: SocioInput = { full_name: "", dni: "", phone: "", email: "" };

/** Alta (sin `socio`) o edición de un socio. */
export function SocioDialog({
  open,
  onOpenChange,
  socio,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socio: Socio | null;
  onSaved: (name: string) => void;
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<SocioInput>({
    resolver: zodResolver(socioSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset(
      socio
        ? { full_name: socio.full_name, dni: socio.dni, phone: socio.phone, email: socio.email }
        : EMPTY
    );
  }, [open, socio, form]);

  const onSubmit = async (values: SocioInput) => {
    setError("");
    setIsSubmitting(true);
    const result = socio
      ? await updateSocioAction(socio.id, values)
      : await createSocioAction(values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar el socio.");
      return;
    }
    onSaved(values.full_name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{socio ? "Editar socio" : "Agregar socio"}</DialogTitle>
          <DialogDescription>
            Solo el nombre es obligatorio. Con DNI o teléfono es más fácil encontrarlo al reservar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre y apellido</FormLabel>
                  <FormControl>
                    <Input placeholder="Mauricio Fernández" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="30111222" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="341 555 1111" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo (opcional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="mauricio@mail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : socio ? "Guardar cambios" : "Agregar socio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
