"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { voidSettlementAction } from "@/app/dashboard/liquidaciones/actions";
import { formatMoney } from "@/lib/pricing";
import { ProcessingButton } from "@/components/processing-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** "Deshacer" una liquidación del historial (por si hubo un error). Solo el admin. */
export function VoidSettlementButton({
  settlementId,
  profeName,
  amount,
  turns,
  paidOn,
}: {
  settlementId: string;
  profeName: string;
  amount: number;
  turns: number;
  /** Día en que se cobró (DD/MM): su caja cambia. */
  paidOn: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onConfirm = async () => {
    setPending(true);
    setError("");
    const result = await voidSettlementAction(settlementId);
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo deshacer la liquidación.");
      return;
    }
    toast.success("Liquidación deshecha", {
      description: `${profeName} · ${result.count ?? 0} ${result.count === 1 ? "turno volvió" : "turnos volvieron"} a pendiente.`,
    });
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && (setError(""), setOpen(next))}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Undo2 />
          Deshacer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Deshacer la liquidación de {profeName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borra el cobro de {formatMoney(amount)} y {turns === 1 ? "el turno vuelve" : `los ${turns} turnos vuelven`} a
            pendiente. La caja del {paidOn} cambia: si ya la cerraste, revisá el cierre de ese día.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <ProcessingButton variant="destructive" processing={pending} processingLabel="Deshaciendo…" onClick={onConfirm}>
            Deshacer liquidación
          </ProcessingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
