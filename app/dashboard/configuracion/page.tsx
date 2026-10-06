"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth-guard";
import { useMembership } from "@/hooks/use-membership";
import { createClient } from "@/lib/supabase/client";
import { clubSettingsSchema, type ClubSettings } from "@/lib/reservations";
import { saveSettingsAction } from "@/app/dashboard/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/shell/page-header";

type SettingsFormValues = {
  cancel_window_hours: number;
  late_penalty_percent: number;
};

export default function ConfiguracionPage() {
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const isAdmin = membership?.role === "admin";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(clubSettingsSchema),
    defaultValues: {
      cancel_window_hours: 24,
      late_penalty_percent: 50,
    },
  });

  const supabase = createClient();

  useEffect(() => {
    if (!membership) return;

    async function load() {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("owner_id", membership!.owner_id)
        .maybeSingle();

      if (data) {
        const settings = data as ClubSettings;
        form.reset({
          cancel_window_hours: settings.cancel_window_hours,
          late_penalty_percent: settings.late_penalty_percent,
        });
      }
    }

    load();
  }, [supabase, membership, form]);

  const handleSubmit = async (values: SettingsFormValues) => {
    setFormError("");
    setIsSubmitting(true);

    const { success, error } = await saveSettingsAction(values);

    if (success) {
      toast.success("Configuración guardada");
    } else {
      setFormError(error ?? "No se pudo guardar la configuración.");
    }
    setIsSubmitting(false);
  };

  if (isLoadingMembership) {
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
            Solo los administradores pueden configurar las políticas del club.
          </AlertDescription>
        </Alert>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <PageHeader
          title="Políticas de cancelación"
          description="Reglas claras para que nadie reserve “por las dudas”."
        />

        <Card className="max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Cancelaciones</CardTitle>
            </div>
            <CardDescription>
              Definí con cuánta anticipación se puede cancelar sin penalidad y
              qué pasa cuando la cancelación es tardía.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  name="cancel_window_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Anticipación mínima para cancelar sin penalidad (horas)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="late_penalty_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Penalidad por cancelación tardía (% del valor del turno)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="text-sm text-muted-foreground">
                  Si el turno tenía una seña cobrada, la cancelación tardía
                  retiene la seña como penalidad. Si no había seña, queda
                  registrada una deuda por el porcentaje indicado.
                </p>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : "Guardar configuración"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
