"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth-guard";
import { useMembership } from "@/hooks/use-membership";
import { useCourts } from "@/hooks/use-courts";
import { formatMoney, getDepositAmount, getSlotPrice } from "@/lib/pricing";
import { cancellationOutcome } from "@/lib/cancellation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createClient } from "@/lib/supabase/client";
import { clubSettingsSchema, type ClubSettings } from "@/lib/reservations";
import { saveSettingsAction } from "@/app/dashboard/configuracion/actions";
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
import { PageHeader } from "@/components/shell/page-header";

type SettingsFormValues = {
  cancel_window_hours: number;
  late_penalty_percent: number;
};

const HOUR_OPTIONS = [2, 6, 12, 24, 48];
const PENALTY_OPTIONS = [0, 25, 50, 100];
const REFERENCE_PRICE = 20000;

export default function ConfiguracionPage() {
  const { membership, isLoading: isLoadingMembership } = useMembership();
  const { courts } = useCourts();
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
        .eq("club_id", membership!.club_id)
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
      form.reset(values);
      toast.success("Políticas guardadas");
    } else {
      setFormError(error ?? "No se pudo guardar la configuración.");
    }
    setIsSubmitting(false);
  };

  const windowHours = Number(form.watch("cancel_window_hours")) || 0;
  const penaltyPercent = Number(form.watch("late_penalty_percent")) || 0;

  // Ejemplo con la primera cancha con precio (o un valor de referencia rotulado).
  const exampleCourt = courts.find((c) => c.price_per_hour > 0);
  const example = (() => {
    const price = exampleCourt
      ? getSlotPrice(exampleCourt, exampleCourt.slot_duration)
      : REFERENCE_PRICE;
    const deposit = exampleCourt
      ? getDepositAmount(exampleCourt, exampleCourt.slot_duration)
      : 0;
    const describe = (late: boolean, paid: number) => {
      const o = cancellationOutcome({ late, slotPrice: price, paid, penaltyPercent });
      const parts = [
        o.retained > 0 && `retiene ${formatMoney(o.retained)}`,
        o.released > 0 && `${formatMoney(o.released)} a favor`,
        o.debt > 0 && `debe ${formatMoney(o.debt)}`,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : "Sin cargo";
    };
    const rows = [
      {
        label: `Cancela con ${windowHours} h o más${deposit > 0 ? " (con seña)" : ""}`,
        result: describe(false, deposit),
      },
      ...(deposit > 0
        ? [{ label: "Cancela tarde, con seña cobrada", result: describe(true, deposit) }]
        : []),
      { label: "Cancela tarde, sin cobros", result: describe(true, 0) },
    ];
    return {
      price,
      deposit,
      rows,
      label: exampleCourt
        ? `${exampleCourt.name}, turno de ${exampleCourt.slot_duration} min`
        : "Valor de referencia (todavía no hay canchas con precio)",
    };
  })();

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
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-6"
        >
          <PageHeader
            title="Políticas de cancelación"
            description="Reglas claras para que nadie reserve “por las dudas”."
            actions={
              <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                {isSubmitting ? "Guardando…" : "Guardar cambios"}
              </Button>
            }
          />

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <section
            aria-label="Línea de tiempo de la cancelación"
            className="flex flex-col gap-4 rounded-[20px] bg-sidebar px-7 pt-7 pb-6 text-sidebar-foreground"
          >
            <div className="flex justify-between gap-3 font-mono text-[13px] text-sidebar-muted">
              <span>Se reserva</span>
              <span className="text-ball">{windowHours} h antes</span>
              <span>Empieza el turno</span>
            </div>
            <div aria-hidden="true" className="flex h-3.5 gap-1 overflow-hidden rounded-full">
              <div className="flex-[3] rounded-full bg-sidebar-foreground" />
              <div
                className="rounded-full bg-ball"
                style={{ flex: Math.max(0.6, Math.min(3, windowHours / 16)) }}
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
              <div className="flex flex-col gap-1">
                <strong className="text-[17px]">En término</strong>
                <span className="text-[15px] leading-snug text-sidebar-muted">
                  Cancela con {windowHours} h o más: lo cobrado queda como saldo a
                  favor para su próximo turno.
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <strong className="text-[17px] text-ball">Fuera de término</strong>
                <span className="text-[15px] leading-snug text-sidebar-muted">
                  Cancela con menos de {windowHours} h: se cobra el {penaltyPercent}% del
                  turno. Se descuenta de lo cobrado y, si no alcanza, queda como deuda.
                </span>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-start gap-6">
            <section
              aria-labelledby="reglas"
              className="flex min-w-0 flex-[999_1_460px] flex-col gap-6 rounded-2xl border bg-card p-6"
            >
              <h2 id="reglas" className="text-lg font-bold">
                Reglas para todos los turnos
              </h2>

              <FormField
                control={form.control}
                name="cancel_window_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[15px]">
                      Anticipación mínima para cancelar sin cargo
                    </FormLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <ToggleGroup
                        type="single"
                        variant="chip"
                        spacing={2}
                        value={HOUR_OPTIONS.includes(Number(field.value)) ? String(field.value) : ""}
                        onValueChange={(v) => v && field.onChange(Number(v))}
                        aria-label="Horas de anticipación"
                        className="flex-wrap"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <ToggleGroupItem key={h} value={String(h)} size="lg">
                            {h} h
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <div className="relative w-28">
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            aria-label="Otra cantidad de horas"
                            className="pr-8 font-mono"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                          h
                        </span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="late_penalty_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[15px]">Penalidad fuera de término</FormLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <ToggleGroup
                        type="single"
                        variant="chip"
                        spacing={2}
                        value={PENALTY_OPTIONS.includes(Number(field.value)) ? String(field.value) : ""}
                        onValueChange={(v) => v && field.onChange(Number(v))}
                        aria-label="Porcentaje de penalidad"
                        className="flex-wrap"
                      >
                        {PENALTY_OPTIONS.map((pct) => (
                          <ToggleGroupItem key={pct} value={String(pct)} size="lg">
                            {pct}%
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <div className="relative w-28">
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="100"
                            step="1"
                            aria-label="Otro porcentaje"
                            className="pr-8 font-mono"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Porcentaje del valor del turno. Con 0% cancelar tarde no cuesta nada.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                Los profesores no pueden cancelar dentro de esta ventana ni turnos
                que ya tienen cobros: se lo piden a un operador o administrador.
              </p>
            </section>

            {example && (
              <section
                aria-labelledby="ejemplo"
                className="flex flex-[1_1_360px] flex-col gap-3 rounded-2xl bg-ball p-6 text-ball-foreground"
              >
                <h2 id="ejemplo" className="text-lg font-bold">
                  Así queda con un turno de {formatMoney(example.price)}
                </h2>
                <p className="text-sm">
                  {example.label}
                  {example.deposit > 0 && (
                    <>
                      {" "}
                      · seña <strong className="font-mono">{formatMoney(example.deposit)}</strong>
                    </>
                  )}
                </p>
                <dl className="flex flex-col text-[15px]">
                  {example.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between gap-3 border-t border-ink/20 py-2.5"
                    >
                      <dt>{row.label}</dt>
                      <dd className="text-right font-mono font-bold">{row.result}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </form>
      </Form>
    </AuthGuard>
  );
}
