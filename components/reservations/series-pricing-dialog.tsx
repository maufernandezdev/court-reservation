"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PRICING_MODES } from "@/lib/special-pricing";
import type { Reservation } from "@/lib/reservations";
import { updateSeriesPricingAction } from "@/app/dashboard/reservas/actions";
import {
  PRICING_MODE_HINTS,
  PricingFields,
  type PricingErrors,
  type PricingValues,
} from "@/components/reservations/pricing-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const seriesPricingFormSchema = z
  .object({
    pricing_mode: z.enum(PRICING_MODES),
    unit_price: z.number().positive("El precio tiene que ser mayor a $0").max(10_000_000, "Precio demasiado alto").nullable(),
    expected_people: z.number().int("Poné un número entero").min(1, "Al menos 1 persona").max(200, "Hasta 200 personas").nullable(),
    custom_price: z.number().min(0, "El monto no puede ser negativo").max(10_000_000, "Monto demasiado alto").nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.pricing_mode === "por_persona" && data.unit_price === null) {
      ctx.addIssue({ code: "custom", path: ["unit_price"], message: "Poné el precio por persona" });
    }
    if (data.pricing_mode === "monto_fijo" && data.custom_price === null) {
      ctx.addIssue({ code: "custom", path: ["custom_price"], message: "Poné el monto del turno" });
    }
  });

function initialValues(reservation: Reservation): PricingValues {
  const mode = reservation.pricing_mode ?? "lista";
  return {
    pricing_mode: mode,
    unit_price: reservation.unit_price === null || reservation.unit_price === undefined ? null : Number(reservation.unit_price),
    expected_people: reservation.expected_people ?? null,
    custom_price: mode === "monto_fijo" ? Number(reservation.price) : null,
  };
}

/** Cambiar cómo se cobra un fijo (solo admin): se aplica de hoy en adelante a las fechas sin cobros. */
export function SeriesPricingDialog({
  reservation,
  open,
  onOpenChange,
  onSaved,
}: {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Después de guardar (para recargar el turno abierto). */
  onSaved: () => void;
}) {
  const [values, setValues] = useState<PricingValues>(() => initialValues(reservation));
  const [errors, setErrors] = useState<PricingErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre, arranca con el precio actual del turno.
  useEffect(() => {
    if (open) {
      setValues(initialValues(reservation));
      setErrors({});
      setFormError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setFormError("");
    const parsed = seriesPricingFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: PricingErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof PricingValues;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const result = await updateSeriesPricingAction({ seriesId: reservation.series_id!, ...parsed.data });
    setSaving(false);
    if (!result.success) {
      setFormError(result.error ?? "No se pudo cambiar el precio del fijo.");
      return;
    }
    const n = result.updated ?? 0;
    toast.success("Precio del fijo actualizado", {
      description: n
        ? `Se aplicó a ${n} ${n === 1 ? "fecha" : "fechas"} de hoy en adelante. Las fechas con cobros quedaron como estaban.`
        : "Las próximas fechas que se generen usan el precio nuevo.",
    });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar precio del fijo</DialogTitle>
          <DialogDescription>
            Vale para este fijo de hoy en adelante. Las fechas que ya tienen cobros no cambian.
          </DialogDescription>
        </DialogHeader>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <PricingFields value={values} onChange={setValues} errors={errors} disabled={saving} />
        <p className="text-[13px] text-pretty text-muted-foreground">{PRICING_MODE_HINTS[values.pricing_mode]}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cerrar
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Guardar precio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
