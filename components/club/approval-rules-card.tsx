"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  WEEKDAYS,
  WEEKDAY_SHORT,
  approvalRuleSchema,
  describeRuleWhen,
  type ApprovalRuleInput,
} from "@/lib/approval";
import { minutesToTime } from "@/lib/availability";
import { createApprovalRuleAction, deleteApprovalRuleAction } from "@/app/dashboard/configuracion/actions";
import { useApprovalRules } from "@/hooks/use-approval-rules";
import { useCourts } from "@/hooks/use-courts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";

const START_OPTIONS = Array.from({ length: 48 }, (_, i) => minutesToTime(i * 30));
const END_OPTIONS = [...START_OPTIONS.slice(1), "24:00"];
const ALL_COURTS = "todas";

const EMPTY: ApprovalRuleInput = {
  court_id: null,
  mode: "weekdays",
  weekdays: [1, 2, 3, 4, 5],
  on_date: "",
  from_time: "19:00",
  to_time: "23:00",
};

/**
 * Horarios bloqueados (Políticas): un operador, profe u organizador no puede reservar dentro de una
 * franja; la app le pide que se comunique con el admin, que carga el turno desde su panel.
 */
export function ApprovalRulesCard() {
  const rules = useApprovalRules();
  const { courts } = useCourts();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const form = useForm<ApprovalRuleInput>({ resolver: zodResolver(approvalRuleSchema), defaultValues: EMPTY });
  const mode = useWatch({ control: form.control, name: "mode" });
  const courtName = (id: string | null) =>
    id ? (courts.find((c) => c.id === id)?.name ?? "Cancha dada de baja") : "Todas las canchas";

  const onSubmit = async (values: ApprovalRuleInput) => {
    setError("");
    setIsSubmitting(true);
    const result = await createApprovalRuleAction(values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo guardar el horario.");
      return;
    }
    toast.success("Horario bloqueado agregado");
    form.reset(EMPTY);
  };

  const remove = async (id: string) => {
    setRemoving(id);
    const result = await deleteApprovalRuleAction(id);
    setRemoving(null);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo quitar el horario.");
      return;
    }
    toast.success("Horario quitado");
  };

  return (
    <section aria-labelledby="confirmacion" className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id="confirmacion" className="text-lg font-bold">
          Horarios bloqueados
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          En estas franjas solo vos cargás turnos. Si un operador, un profe o el organizador quiere reservar, la
          app le pide que se comunique con vos (por WhatsApp) y vos lo cargás desde tu panel.
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Todavía no hay horarios bloqueados: todo el equipo puede reservar en cualquier horario.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-3 rounded-xl border px-4 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <strong className="text-[15px]">{describeRuleWhen(rule)}</strong>
                <span className="text-[13px] text-muted-foreground">{courtName(rule.court_id)}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${describeRuleWhen(rule)}`}
                disabled={removing === rule.id}
                onClick={() => remove(rule.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 border-t pt-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="court_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancha</FormLabel>
                  <Select
                    value={field.value ?? ALL_COURTS}
                    onValueChange={(v) => field.onChange(v === ALL_COURTS ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ALL_COURTS}>Todas las canchas</SelectItem>
                      {courts.map((court) => (
                        <SelectItem key={court.id} value={court.id}>
                          {court.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id="rule-mode-label">Cuándo</FormLabel>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    spacing={1}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                    aria-labelledby="rule-mode-label"
                    className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                  >
                    <ToggleGroupItem value="weekdays" className="h-9 w-full">
                      Días de la semana
                    </ToggleGroupItem>
                    <ToggleGroupItem value="date" className="h-9 w-full">
                      Una fecha
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormItem>
              )}
            />
          </div>

          {mode === "weekdays" ? (
            <FormField
              control={form.control}
              name="weekdays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id="rule-days-label">Días</FormLabel>
                  <ToggleGroup
                    type="multiple"
                    variant="chip"
                    spacing={2}
                    value={field.value.map(String)}
                    onValueChange={(values) => field.onChange(values.map(Number))}
                    aria-labelledby="rule-days-label"
                    className="flex-wrap"
                  >
                    {WEEKDAYS.map((day) => (
                      <ToggleGroupItem key={day} value={String(day)}>
                        {WEEKDAY_SHORT[day]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="on_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <DateInput value={field.value ?? ""} onChange={field.onChange} className="w-full sm:w-auto" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            {(["from_time", "to_time"] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{name === "from_time" ? "Desde" : "Hasta"}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full font-mono">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(name === "from_time" ? START_OPTIONS : END_OPTIONS).map((t) => (
                          <SelectItem key={t} value={t} className="font-mono">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <div>
            <Button type="submit" disabled={isSubmitting}>
              <Plus />
              {isSubmitting ? "Guardando…" : "Agregar horario"}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
