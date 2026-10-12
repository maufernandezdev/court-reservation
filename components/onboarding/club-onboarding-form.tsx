"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert, Minus, Plus } from "lucide-react";
import {
  MAX_COURTS_PER_SPORT,
  ONBOARDING_SPORTS,
  clubOnboardingSchema,
  previewCourtNames,
  type ClubOnboardingInput,
} from "@/lib/clubs";
import { createClubAction } from "@/app/bienvenida/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** Alta del club: datos, deportes y canchas por deporte, con vista previa de la planilla. */
export function ClubOnboardingForm({ backHref }: { backHref: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<ClubOnboardingInput>({
    resolver: zodResolver(clubOnboardingSchema),
    defaultValues: { name: "", city: "", courts: { tenis: 0, padel: 0, futbol: 0 } },
  });

  const courts = useWatch({ control: form.control, name: "courts" });
  const preview = previewCourtNames(courts);
  const total = preview.length;
  const selectedSports = ONBOARDING_SPORTS.filter((sport) => courts[sport.id] > 0);

  const setCount = (sport: keyof ClubOnboardingInput["courts"], value: number) => {
    form.setValue(`courts.${sport}`, Math.max(0, Math.min(MAX_COURTS_PER_SPORT, value)), {
      shouldDirty: true,
    });
    // El mínimo de canchas se valida sobre todo el objeto: revalidar después del primer envío.
    if (form.formState.isSubmitted) void form.trigger("courts");
  };

  const onSubmit = (values: ClubOnboardingInput) => {
    setError("");
    startTransition(async () => {
      // Si sale bien, la acción redirige a Canchas (paso 3).
      const result = await createClubAction(values);
      if (result && !result.success) setError(result.error);
    });
  };

  const courtsError = form.formState.errors.courts?.message;

  return (
    <div className="flex flex-wrap items-start gap-10">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-w-0 flex-[1_1_400px] flex-col gap-7"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[13px] text-muted-foreground">PASO 2 DE 3</span>
            <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] font-stretch-[112%] sm:text-[32px]">
              Contanos de tu club
            </h1>
          </div>

          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del club</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" className="h-12 text-base" {...field} />
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
                  <Input
                    placeholder="Ej: Rosario, Santa Fe"
                    autoComplete="address-level2"
                    className="h-12 text-base"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-semibold">¿Qué se juega en tu club?</legend>
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_SPORTS.map((sport) => {
                const on = courts[sport.id] > 0;
                return (
                  <Toggle
                    key={sport.id}
                    pressed={on}
                    onPressedChange={(pressed) => setCount(sport.id, pressed ? 1 : 0)}
                    className="h-11 rounded-full border-[1.5px] border-input bg-card px-[18px] text-[15px] font-semibold data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
                  >
                    {sport.label}
                  </Toggle>
                );
              })}
            </div>
          </fieldset>

          {selectedSports.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold">¿Cuántas canchas tenés de cada una?</span>
              {selectedSports.map((sport) => (
                <div
                  key={sport.id}
                  className="flex items-center justify-between rounded-xl border bg-card py-2 pr-2 pl-4"
                >
                  <span className="text-base font-semibold">{sport.label}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Quitar una cancha de ${sport.label}`}
                      onClick={() => setCount(sport.id, courts[sport.id] - 1)}
                    >
                      <Minus />
                    </Button>
                    <output
                      aria-live="polite"
                      aria-label={`Canchas de ${sport.label}`}
                      className="w-11 text-center font-mono text-lg font-semibold"
                    >
                      {courts[sport.id]}
                    </output>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Agregar una cancha de ${sport.label}`}
                      disabled={courts[sport.id] >= MAX_COURTS_PER_SPORT}
                      onClick={() => setCount(sport.id, courts[sport.id] + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {courtsError && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {courtsError}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="lg">
              <Link href={backHref}>Volver</Link>
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
              {isPending
                ? "Creando el club…"
                : total > 0
                  ? `Crear ${total} ${total === 1 ? "cancha" : "canchas"}`
                  : "Crear club"}
              {!isPending && <ArrowRight className="text-ball" />}
            </Button>
          </div>
        </form>
      </Form>

      <aside
        aria-label="Vista previa"
        className="flex flex-[1_1_320px] flex-col gap-4 rounded-[20px] bg-sidebar p-6 text-sidebar-foreground"
      >
        <div className="flex items-baseline justify-between font-mono text-[13px]">
          <span className="text-sidebar-label">TU PLANILLA</span>
          <span className="text-ball">
            {total} {total === 1 ? "cancha" : "canchas"}
          </span>
        </div>
        {total > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {preview.map((court) => (
              <li
                key={`${court.sport}-${court.name}`}
                className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-lg border-[1.5px] border-sidebar-foreground/30 p-2"
              >
                <span aria-hidden="true" className="absolute inset-y-0 left-1/2 border-l border-sidebar-foreground/18" />
                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t-[1.5px] border-sidebar-foreground/30" />
                <span className="relative font-mono text-xs">{court.sport}</span>
                <strong className="relative w-fit bg-sidebar pr-1 text-sm">{court.name}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-sidebar-foreground/30 px-4 py-8 text-center text-sm text-sidebar-muted">
            Elegí qué se juega y vas a ver tus canchas acá.
          </p>
        )}
        <p className="text-sm leading-normal text-sidebar-muted">
          En el paso siguiente definís precio, duración del turno y seña de cada una.
        </p>
      </aside>
    </div>
  );
}
