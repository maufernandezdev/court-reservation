"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clubDetailsSchema, type ClubDetailsInput } from "@/lib/clubs";
import type { Club } from "@/lib/roles";
import { updateClubDetailsAction } from "@/app/dashboard/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** "Datos del club" en Políticas: nombre y ciudad (solo admin). */
export function ClubDetailsForm({ club }: { club: Club }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClubDetailsInput>({
    resolver: zodResolver(clubDetailsSchema),
    defaultValues: { name: club.name, city: club.city },
  });

  const onSubmit = async (values: ClubDetailsInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await updateClubDetailsAction(values);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "No se pudieron guardar los datos del club.");
      return;
    }

    form.reset({ name: values.name.trim(), city: values.city.trim() });
    toast.success("Datos del club guardados");
  };

  return (
    <section
      aria-labelledby="datos-del-club"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="datos-del-club" className="text-lg font-bold">
          Datos del club
        </h2>
        <p className="text-[15px] text-muted-foreground">
          El nombre se ve en el menú de todo el equipo y en las invitaciones.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del club</FormLabel>
                  <FormControl>
                    <Input autoComplete="organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Rosario, Santa Fe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting ? "Guardando…" : "Guardar datos del club"}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
