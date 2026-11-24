"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, LockOpen, Plus, Trash2, Users } from "lucide-react";
import {
  PAYMENT_METHOD_LABELS,
  VISIBLE_PAYMENT_METHODS,
  type Payment,
  type Reservation,
  type VisiblePaymentMethod,
} from "@/lib/reservations";
import { formatMoney } from "@/lib/pricing";
import {
  registerPersonPaymentsAction,
  reopenPersonReservationAction,
} from "@/app/dashboard/reservas/actions";
import { ProcessingButton } from "@/components/processing-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const methodSchema = z.enum(VISIBLE_PAYMENT_METHODS, { message: "Elegí efectivo o Mercado Pago" });
const amountSchema = z
  .number({ message: "Poné el monto" })
  .positive("El monto tiene que ser mayor a $0")
  .max(10_000_000, "Monto demasiado alto");

/** Cobro de una persona. */
const personPaymentSchema = z.object({
  payer_name: z.string().trim().max(120, "Nombre demasiado largo"),
  amount: amountSchema,
  method: methodSchema,
});
type PersonPaymentValues = z.infer<typeof personPaymentSchema>;

/** Cobro único (repartido en uno o más medios) y cierre de la cuenta. */
const closeAccountSchema = z.object({
  people: z
    .number({ message: "Poné cuántas personas vinieron" })
    .int("Poné un número entero")
    .min(1, "Al menos 1 persona")
    .max(200, "Hasta 200 personas"),
  lines: z
    .array(
      z.object({
        method: methodSchema,
        amount: z.number({ message: "Poné el monto" }).min(0, "El monto no puede ser negativo").max(10_000_000, "Monto demasiado alto"),
      })
    )
    .max(10, "Hasta 10 medios de pago"),
});
type CloseAccountValues = z.infer<typeof closeAccountSchema>;

function toNumber(value: string): number {
  return value === "" ? Number.NaN : Number(value);
}

function MethodToggle({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: VisiblePaymentMethod;
  onChange: (v: VisiblePaymentMethod) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      spacing={1}
      value={value}
      onValueChange={(v) => v && onChange(v as VisiblePaymentMethod)}
      disabled={disabled}
      aria-labelledby={labelledBy}
      className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
    >
      {VISIBLE_PAYMENT_METHODS.map((m) => (
        <ToggleGroupItem key={m} value={m} className="h-9 w-full">
          {PAYMENT_METHOD_LABELS[m]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * Cuenta de un turno por persona: quién pagó y cuánto, cobrar a una persona, cobro único
 * repartido en varios medios con cierre, cerrar y reabrir. Cobra solo el admin.
 */
export function PersonAccount({
  reservation,
  payments,
  isAdmin,
  isCancelled,
  onChanged,
}: {
  reservation: Reservation;
  payments: Payment[];
  isAdmin: boolean;
  isCancelled: boolean;
  /** Después de un cobro, cierre o reapertura, con el turno actualizado. */
  onChanged: (reservation: Reservation) => Promise<void> | void;
}) {
  const unitPrice = Number(reservation.unit_price ?? 0);
  const personPayments = payments.filter((p) => p.kind === "persona" && !p.released);
  const collected = personPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const isClosed = !!reservation.closed_at;
  const canCharge = isAdmin && !isCancelled && !isClosed && reservation.status === "active";

  const [singleOpen, setSingleOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [busy, setBusy] = useState<null | "person" | "single" | "close" | "reopen">(null);
  const busyRef = useRef(false);

  const run = async (kind: NonNullable<typeof busy>, fn: () => ReturnType<typeof registerPersonPaymentsAction>, ok: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(kind);
    try {
      const result = await fn();
      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar.");
        return false;
      }
      toast.success(ok);
      if (result.reservation) await onChanged(result.reservation);
      return true;
    } catch {
      toast.error("No se pudo guardar.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  // Cobrar a una persona
  const personForm = useForm<PersonPaymentValues>({
    resolver: zodResolver(personPaymentSchema),
    defaultValues: { payer_name: "", amount: unitPrice, method: "efectivo" },
  });
  const personAmount = useWatch({ control: personForm.control, name: "amount" });
  const chargePerson = personForm.handleSubmit(async (values) => {
    const done = await run(
      "person",
      () =>
        registerPersonPaymentsAction({
          reservationId: reservation.id,
          lines: [{ amount: values.amount, method: values.method, payer_name: values.payer_name || null }],
          close: false,
          people: null,
        }),
      `Cobro de ${formatMoney(values.amount)} registrado`
    );
    if (done) personForm.reset({ payer_name: "", amount: unitPrice, method: values.method });
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users aria-hidden="true" className="size-4" />
          Cuenta por persona · {formatMoney(unitPrice)} c/u
        </span>
        {isClosed ? (
          <Badge variant="outline" className="gap-1">
            <Lock aria-hidden="true" />
            Cerrada
          </Badge>
        ) : (
          <Badge variant="outline">Abierta</Badge>
        )}
      </div>

      <p className="text-sm">
        {isClosed
          ? `${reservation.expected_people ?? personPayments.length} ${(reservation.expected_people ?? personPayments.length) === 1 ? "persona" : "personas"} · `
          : `${personPayments.length} ${personPayments.length === 1 ? "cobro" : "cobros"} · `}
        <strong className="font-mono">{formatMoney(collected)}</strong> cobrado
        {!isClosed && reservation.expected_people ? ` · suelen ser ${reservation.expected_people}` : ""}
      </p>

      {personPayments.length > 0 && (
        <ul className="flex flex-col gap-1 border-t pt-2 text-[13px]">
          {personPayments.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span className="truncate">
                {p.payer_name || "Sin nombre"} · <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[p.method]}</span>
              </span>
              <span className="font-mono">{formatMoney(Number(p.amount))}</span>
            </li>
          ))}
        </ul>
      )}

      {!isAdmin && !isClosed && !isCancelled && (
        <p className="text-[13px] text-muted-foreground">Los cobros de este turno los registra el administrador.</p>
      )}

      {canCharge && (
        <Form {...personForm}>
          <form onSubmit={chargePerson} className="flex flex-col gap-2.5 border-t pt-3" noValidate>
            <span className="text-sm font-semibold">Cobrar a una persona</span>
            <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-[1fr_8rem]">
              <FormField
                control={personForm.control}
                name="payer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre (opcional)" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={personForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Monto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={500}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(e) => field.onChange(toNumber(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={personForm.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Medio de pago</FormLabel>
                  <MethodToggle value={field.value} onChange={field.onChange} disabled={busy !== null} />
                </FormItem>
              )}
            />
            <ProcessingButton
              type="submit"
              processing={busy === "person"}
              disabled={busy !== null}
              processingLabel="Procesando cobro…"
            >
              Cobrar {Number.isFinite(personAmount) && personAmount > 0 ? formatMoney(personAmount) : ""}
            </ProcessingButton>
          </form>
        </Form>
      )}

      {canCharge && (
        <div className="grid grid-cols-1 gap-2 border-t pt-3 min-[360px]:grid-cols-2">
          <Button variant="outline" onClick={() => setSingleOpen(true)} disabled={busy !== null}>
            Cobro único y cerrar
          </Button>
          <Button
            variant="outline"
            onClick={() => setCloseOpen(true)}
            disabled={busy !== null || personPayments.length === 0}
          >
            <Lock />
            Cerrar cuenta
          </Button>
        </div>
      )}

      {isAdmin && isClosed && !isCancelled && (
        <ProcessingButton
          variant="outline"
          processing={busy === "reopen"}
          disabled={busy !== null}
          processingLabel="Reabriendo…"
          onClick={() =>
            run("reopen", () => reopenPersonReservationAction(reservation.id), "Cuenta reabierta")
          }
        >
          <LockOpen />
          Reabrir cuenta
        </ProcessingButton>
      )}

      {canCharge && (
        <SinglePaymentDialog
          open={singleOpen}
          onOpenChange={setSingleOpen}
          unitPrice={unitPrice}
          collected={collected}
          defaultPeople={reservation.expected_people ?? Math.max(personPayments.length, 1)}
          processing={busy === "single"}
          onConfirm={async (values) => {
            const done = await run(
              "single",
              () =>
                registerPersonPaymentsAction({
                  reservationId: reservation.id,
                  lines: values.lines.map((l) => ({ ...l, payer_name: null })),
                  close: true,
                  people: values.people,
                }),
              "Cobro registrado y cuenta cerrada"
            );
            if (done) setSingleOpen(false);
          }}
        />
      )}

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedan {personPayments.length} {personPayments.length === 1 ? "cobro" : "cobros"} por{" "}
              {formatMoney(collected)} y el turno pasa a pagado. Si hace falta, la podés reabrir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mejor no</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              onClick={() =>
                run(
                  "close",
                  () =>
                    registerPersonPaymentsAction({
                      reservationId: reservation.id,
                      lines: [],
                      close: true,
                      people: personPayments.length || null,
                    }),
                  "Cuenta cerrada"
                )
              }
            >
              Cerrar cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Cobro único: cuántas personas vinieron, total sugerido y uno o más medios de pago. */
function SinglePaymentDialog({
  open,
  onOpenChange,
  unitPrice,
  collected,
  defaultPeople,
  processing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitPrice: number;
  collected: number;
  defaultPeople: number;
  processing: boolean;
  onConfirm: (values: CloseAccountValues) => Promise<void>;
}) {
  const suggestedFor = (people: number) => Math.max(0, unitPrice * people - collected);
  const form = useForm<CloseAccountValues>({
    resolver: zodResolver(closeAccountSchema),
    defaultValues: { people: defaultPeople, lines: [{ method: "efectivo", amount: suggestedFor(defaultPeople) }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const [people, lines] = useWatch({ control: form.control, name: ["people", "lines"] });
  const suggested = Number.isFinite(people) ? suggestedFor(people) : 0;
  const linesTotal = (lines ?? []).reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);

  // Cada vez que se abre arranca de cero, con lo ya cobrado descontado del sugerido.
  useEffect(() => {
    if (open) {
      form.reset({ people: defaultPeople, lines: [{ method: "efectivo", amount: suggestedFor(defaultPeople) }] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Al cambiar la cantidad, si hay un solo medio, su monto sigue al sugerido.
  const handlePeopleChange = (value: number) => {
    form.setValue("people", value, { shouldValidate: form.formState.isSubmitted });
    if (form.getValues("lines").length === 1 && Number.isFinite(value)) {
      form.setValue("lines.0.amount", suggestedFor(value));
    }
  };

  const submit = form.handleSubmit(async (values) => {
    // Las líneas sin monto (o en $0) no se registran: cerrar sin cobrar más también vale.
    await onConfirm({ ...values, lines: values.lines.filter((l) => l.amount > 0) });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobro único y cerrar</DialogTitle>
          <DialogDescription>
            Registrá lo que entró todo junto, repartido por medio de pago, y la cuenta queda cerrada.
            {collected > 0 && ` Ya se cobraron ${formatMoney(collected)} de a uno.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="people"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personas que vinieron</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(e) => handlePeopleChange(toNumber(e.target.value))}
                    />
                  </FormControl>
                  <p className="text-[13px] text-muted-foreground">
                    Sugerido: {formatMoney(suggested)} ({formatMoney(unitPrice)} c/u
                    {collected > 0 ? `, menos lo ya cobrado` : ""})
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold">Medios de pago</span>
              {fields.map((line, index) => (
                <div key={line.id} className="flex flex-col gap-2 rounded-lg border p-2.5">
                  <div className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.amount`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="sr-only">Monto</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={500}
                              value={Number.isNaN(field.value) ? "" : field.value}
                              onChange={(e) => field.onChange(toNumber(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        aria-label="Quitar este medio"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name={`lines.${index}.method`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Medio de pago</FormLabel>
                        <MethodToggle value={field.value} onChange={field.onChange} />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
              {fields.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    append({
                      method: lines?.some((l) => l.method === "efectivo") ? "mercado_pago" : "efectivo",
                      amount: Math.max(0, suggested - linesTotal),
                    })
                  }
                >
                  <Plus />
                  Agregar otro medio
                </Button>
              )}
              <p className="flex justify-between text-sm">
                <span>Total a registrar</span>
                <strong className="font-mono">{formatMoney(linesTotal)}</strong>
              </p>
              {linesTotal !== suggested && (
                <p className="text-[13px] text-muted-foreground">
                  No coincide con el sugerido ({formatMoney(suggested)}): se registra lo que pusiste.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                Cerrar
              </Button>
              <ProcessingButton type="submit" processing={processing} processingLabel="Procesando cobro…">
                Cobrar {formatMoney(linesTotal)} y cerrar
              </ProcessingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
