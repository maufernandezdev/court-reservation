"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Clock, Moon, Percent, Tag } from "lucide-react";
import type { CourtType } from "@/lib/courts";
import type { ClubHours } from "@/lib/availability";
import type { SportPrices } from "@/lib/pricing";
import { ClubHoursForm } from "@/components/club/club-hours-form";
import { SportPricesSection } from "@/components/prices/sport-prices-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "welcome" | "hours" | "prices";

/**
 * Botón "Precios" de Canchas y su modal: horario de la noche, precios de día y de noche y señas
 * (público y profes) de cada deporte. Con `onboarding` (club recién creado) se abre solo y arranca
 * con una bienvenida; "Siguiente" pide el horario del club y después muestra los precios iniciales.
 */
export function PricesDialog({
  clubName,
  sports,
  rows,
  nightStartsAt,
  hours,
  onboarding,
}: {
  clubName: string;
  sports: CourtType[];
  rows: SportPrices[];
  nightStartsAt: string;
  /** Horario del club (se pide en el paso 2 de la bienvenida). */
  hours: ClubHours;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(onboarding);
  const [step, setStep] = useState<Step>(onboarding ? "welcome" : "prices");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    // Al cerrar, la bienvenida no vuelve a aparecer ni al recargar la página.
    if (onboarding) router.replace("/dashboard/canchas");
    setStep("prices");
  };

  const openFromButton = () => {
    setStep("prices");
    setOpen(true);
  };

  return (
    <>
      <Button variant="outline" onClick={openFromButton}>
        <BadgeDollarSign className="mr-2 h-4 w-4" />
        Precios
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        {step === "welcome" ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                ¡Bienvenido a saque!
              </DialogTitle>
              <DialogDescription>
                Tu club <strong className="text-foreground">{clubName}</strong> ya está creado. Antes de empezar a
                reservar, cargá los precios de tus canchas.
              </DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-3 text-[15px]">
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>El horario de apertura y cierre del club.</span>
              </li>
              <li className="flex items-start gap-3">
                <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>El precio por hora del público y de los profes, de cada deporte.</span>
              </li>
              <li className="flex items-start gap-3">
                <Moon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>Desde qué hora rige el precio de noche y cuánto cuesta (si lo dejás vacío, se cobra el de día).</span>
              </li>
              <li className="flex items-start gap-3">
                <Percent className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>La seña para los turnos de profe. La del público viene apagada.</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Después los cambiás cuando quieras: el horario en Políticas y los precios en Canchas → Precios.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Más tarde
              </Button>
              <Button onClick={() => setStep("hours")}>Siguiente</Button>
            </DialogFooter>
          </DialogContent>
        ) : step === "hours" ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                Horario del club
              </DialogTitle>
              <DialogDescription>
                ¿Desde qué hora hasta qué hora se puede reservar? Es el mismo para todas tus canchas.
              </DialogDescription>
            </DialogHeader>
            <ClubHoursForm
              openTime={hours.open_time}
              closeTime={hours.close_time}
              submitLabel="Guardar y seguir"
              onSaved={() => setStep("prices")}
              secondary={
                <Button type="button" variant="outline" onClick={() => setStep("welcome")}>
                  Atrás
                </Button>
              }
            />
          </DialogContent>
        ) : (
          <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-[60rem]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                {onboarding ? "Precios iniciales" : "Precios"}
              </DialogTitle>
              <DialogDescription>
                Valen para todas las canchas del mismo deporte. Los turnos ya reservados mantienen el valor con el
                que se reservaron.
              </DialogDescription>
            </DialogHeader>

            {sports.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                Los precios se cargan por deporte: primero creá una cancha.
              </p>
            ) : (
              <SportPricesSection sports={sports} rows={rows} nightStartsAt={nightStartsAt} />
            )}

            <DialogFooter>
              {onboarding && (
                <Button variant="outline" onClick={() => setStep("hours")}>
                  Atrás
                </Button>
              )}
              <Button onClick={() => handleOpenChange(false)}>{onboarding ? "Listo" : "Cerrar"}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
