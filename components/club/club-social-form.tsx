"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clubSocialSchema, type ClubSocialInput } from "@/lib/clubs";
import { updateClubSocialAction } from "@/app/dashboard/configuracion/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

/** WhatsApp e Instagram del club: van al pie de los mensajes de turnos libres y al aviso de "Por confirmar". */
export function ClubSocialForm({ whatsapp, instagram }: { whatsapp: string; instagram: string }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<ClubSocialInput>({
    resolver: zodResolver(clubSocialSchema),
    defaultValues: { whatsapp, instagram: instagram ? `@${instagram}` : "" },
  });

  const onSubmit = async (values: ClubSocialInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await updateClubSocialAction(values);
    setIsSubmitting(false);
    if (!result.success || !result.values) {
      setError(result.error ?? "No se pudieron guardar las redes del club.");
      return;
    }
    form.reset({
      whatsapp: result.values.whatsapp,
      instagram: result.values.instagram ? `@${result.values.instagram}` : "",
    });
    toast.success("Redes del club guardadas");
  };

  return (
    <section aria-labelledby="redes" className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id="redes" className="text-lg font-bold">
          Redes del club
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          Se suman al final de los mensajes de turnos libres que copiás para WhatsApp, y el aviso de un horario
          por confirmar le llega a este WhatsApp.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="off" placeholder="1155551111" className="font-mono" {...field} />
                  </FormControl>
                  <FormDescription>Solo números, con código de área. Vacío si no querés mostrarlo.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instagram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="@thegardentenis" {...field} />
                  </FormControl>
                  <FormDescription>Usuario o link del perfil.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting ? "Guardando…" : "Guardar redes"}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
